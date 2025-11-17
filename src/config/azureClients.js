import { BlobServiceClient, BlobSASPermissions} from '@azure/storage-blob';
import { AzureOpenAI } from 'openai';
import { SearchClient, SearchIndexClient, AzureKeyCredential as SearchKeyCredential } from '@azure/search-documents';
import { DocumentAnalysisClient, AzureKeyCredential as DocKeyCredential } from '@azure/ai-form-recognizer';
import dotenv from 'dotenv';

dotenv.config();

// Blob Storage Client
export const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

export const containerClient = blobServiceClient.getContainerClient(
  process.env.STORAGE_CONTAINER_NAME
);

// Azure OpenAI Client
// Azure OpenAI Client
export const openAIClient = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-08-01-preview'
});


// Azure AI Search Client
export const searchClient = new SearchClient(
  process.env.AZURE_SEARCH_ENDPOINT,
  process.env.AZURE_SEARCH_INDEX_NAME,
  new SearchKeyCredential(process.env.AZURE_SEARCH_API_KEY)
);

export const searchIndexClient = new SearchIndexClient(
  process.env.AZURE_SEARCH_ENDPOINT,
  new SearchKeyCredential(process.env.AZURE_SEARCH_API_KEY)
);

// Document Intelligence Client
export const docIntelligenceClient = new DocumentAnalysisClient(
  process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT,
  new DocKeyCredential(process.env.AZURE_DOC_INTELLIGENCE_KEY)
);

// Initialize Search Index (run once)
export async function initializeSearchIndex() {
  try {
    const index = {
      name: process.env.AZURE_SEARCH_INDEX_NAME,
      fields: [
        {
          name: 'id',
          type: 'Edm.String',
          key: true,
          searchable: false,
          filterable: true,
          sortable: true
        },
        {
  name: 'content',
  type: 'Edm.String',
  searchable: true,
  retrievable: true,
  filterable: false,
  sortable: false
},


        {
          name: 'contentVector',
          type: 'Collection(Edm.Single)',
          searchable: true,
          vectorSearchDimensions: 1536,          // <-- important
          vectorSearchProfileName: 'vector-profile', // <-- important
          retrievable: false,
          filterable: false,
          sortable: false,
          facetable: false
        },
        {
  name: 'fileName',
  type: 'Edm.String',
  searchable: true,
  retrievable: true,
  filterable: true,
  sortable: true
},

        {
          name: 'fileType',
          type: 'Edm.String',
          searchable: false,
          filterable: true,
          facetable: true
        },
        {
          name: 'language',
          type: 'Edm.String',
          searchable: false,
          filterable: true,
          facetable: true
        },
        {
          name: 'uploadDate',
          type: 'Edm.DateTimeOffset',
          searchable: false,
          filterable: true,
          sortable: true
        },
        {
  name: 'metadata',
  type: 'Edm.String',
  searchable: true,
  retrievable: true
}

      ],
                  vectorSearch: {
        algorithms: [
          {
            name: 'vector-algorithm',
            kind: 'hnsw',
            hnswParameters: {
              m: 4,
              efConstruction: 400,
              efSearch: 500,
              metric: 'cosine'
            }
          }
        ],
        profiles: [
          {
            name: 'vector-profile',
            algorithmConfigurationName: 'vector-algorithm'
          }
        ]
      },
      semantic: {
  configurations: [
    {
      name: 'semantic-config',
      prioritizedFields: {
        titleField: { fieldName: 'fileName' },
        contentFields: [{ fieldName: 'content' }],
        keywordsFields: [{ fieldName: 'metadata' }]
      }
    }
  ]
}
    };


    await searchIndexClient.createOrUpdateIndex(index);
    console.log('✅ Search index created/updated successfully');
  } catch (error) {
    console.error('Error creating search index:', error);
    throw error;
  }
}
