import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

// Initialize Azure OpenAI for embeddings
const openaiClient = new OpenAIClient(
  process.env.AZURE_OPENAI_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
);

class EmbeddingService {
  constructor() {
    // Primary and backup deployment names
    this.primaryDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';
    this.backupDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_BACKUP || 'text-embedding-ada-002-backup';
    
    // Track which deployment to use (alternating for load balancing)
    this.useBackup = false;
    
    // Track rate limit status
    this.primaryRateLimited = false;
    this.backupRateLimited = false;
    this.rateLimitResetTime = null;
  }

  /**
   * Sleep utility for retry delays
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate embeddings with automatic fallback and retry
   */
  async generateEmbeddings(texts) {
    try {
      if (!Array.isArray(texts)) {
        texts = [texts];
      }

      console.log(`🔄 Generating embeddings for ${texts.length} texts using Azure OpenAI...`);

      // Choose deployment (alternate between primary and backup for load balancing)
      let deploymentName = this.useBackup ? this.backupDeployment : this.primaryDeployment;
      this.useBackup = !this.useBackup; // Toggle for next request

      // If both are rate limited, wait for reset
      if (this.primaryRateLimited && this.backupRateLimited) {
        const waitTime = this.rateLimitResetTime ? Math.max(0, this.rateLimitResetTime - Date.now()) : 60000;
        console.log(`⏳ Both deployments rate limited. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await this.sleep(waitTime);
        
        // Reset rate limit flags after waiting
        this.primaryRateLimited = false;
        this.backupRateLimited = false;
      }

      // Try primary deployment first, then backup if rate limited
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const textStrings = texts.map(t => String(t));
          
          console.log(`   Using deployment: ${deploymentName}`);
          const response = await openaiClient.getEmbeddings(deploymentName, textStrings);
          const embeddings = response.data.map(item => item.embedding);

          console.log(`✅ Generated ${embeddings.length} embeddings (dimension: ${embeddings[0].length})`);
          
          // Reset rate limit flag for this deployment on success
          if (deploymentName === this.primaryDeployment) {
            this.primaryRateLimited = false;
          } else {
            this.backupRateLimited = false;
          }
          
          return embeddings;

        } catch (error) {
          // Check if it's a rate limit error
          if (error.code === 'RateLimitReached' || error.statusCode === 429) {
            console.log(`⚠️ Rate limit hit on ${deploymentName}`);
            
            // Mark this deployment as rate limited
            if (deploymentName === this.primaryDeployment) {
              this.primaryRateLimited = true;
            } else {
              this.backupRateLimited = true;
            }
            
            // Set reset time (60 seconds from now)
            this.rateLimitResetTime = Date.now() + 60000;
            
            // Try backup deployment
            if (attempt === 0) {
              deploymentName = deploymentName === this.primaryDeployment 
                ? this.backupDeployment 
                : this.primaryDeployment;
              console.log(`🔄 Switching to backup deployment: ${deploymentName}`);
              continue;
            }
            
            // Both failed, wait and retry once
            console.log(`⏳ Waiting 60 seconds before retry...`);
            await this.sleep(60000);
            
            // Reset flags and try again
            this.primaryRateLimited = false;
            this.backupRateLimited = false;
            deploymentName = this.primaryDeployment;
            
            const textStrings = texts.map(t => String(t));
            const response = await openaiClient.getEmbeddings(deploymentName, textStrings);
            const embeddings = response.data.map(item => item.embedding);
            console.log(`✅ Generated ${embeddings.length} embeddings after retry`);
            return embeddings;
            
          } else {
            // Not a rate limit error, throw it
            throw error;
          }
        }
      }

    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  /**
   * Generate single embedding
   */
  async generateEmbedding(text) {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }
}

export const embeddingService = new EmbeddingService();