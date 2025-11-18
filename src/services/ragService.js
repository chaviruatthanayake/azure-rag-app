import { searchService } from "./searchService.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export class RAGService {
  constructor() {
    // Load Gemini model
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    });
  }

  /**
   * Main RAG answer generation
   */
  async answerQuery(query, language = "english") {
    try {
      console.log(`💬 Generating answer for: "${query}"`);

      //  Search from Azure Cognitive Search
      const docs = await searchService.searchDocuments(query);
      console.log(`🔎 RAG: got ${docs.length} docs`);

      if (!docs.length) {
        return {
          answer: "No relevant information found in the indexed documents.",
          sources: [],
          usedInternetSearch: false,
        };
      }

      //  Build prompt for Gemini
      const prompt = `
You are a highly accurate AI assistant. You MUST answer ONLY using the provided document content.

----------------------------
DOCUMENTS
----------------------------

${docs
  .map(
    (d, i) => `
[Document ${i + 1}]
File: ${d.fileName}
Content:
${d.content}
`
  )
  .join("\n\n")}

----------------------------
QUESTION
----------------------------
${query}

----------------------------
ANSWER RULES
----------------------------
- Use ONLY the content from the documents above  
- Do NOT guess or hallucinate  
- If answer is not found, say: "Information not found in the provided documents."
- Make answer clean, structured, and helpful
`;

      // Get answer from Gemini (Flash model)
      const result = await this.model.generateContent(prompt);
      const answer = result.response.text();

      return {
        success: true,
        answer,
        sources: docs,
        usedInternetSearch: false,
        language,
      };
    } catch (err) {
      console.error("Gemini RAG Error:", err);
      throw err;
    }
  }
  async generateAnswer(query, language = "english") {
    return this.answerQuery(query, language);
  }
}

export const ragService = new RAGService();
