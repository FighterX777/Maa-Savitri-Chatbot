const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors({
  origin: [
    "https://chat-bot-one-vert-80.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "DELETE"],
  credentials: true
}));

app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are a helpful assistant for Maa Savitri Consultancy Services, an educational consultancy based in Siwan, Bihar. You handle new contact queries professionally and warmly.
 
LANGUAGE RULE (most important):
- The very first user message will either be a language selection ("English" or "हिंदी") or a general query.
- If the user selects English or writes in English → respond ONLY in English for the entire conversation.
- If the user selects हिंदी or writes in Hindi → respond ONLY in Hindi for the entire conversation.
- Once language is set, NEVER switch languages unless the user explicitly asks to change.
- After language selection, warmly greet the user and ask how you can help them today.
 
About the Organization:
- Educational consultancy focused on improving education quality in Bihar and eastern Uttar Pradesh
- Based in Siwan, Bihar
- Services: teacher recruitment, non-teaching staff recruitment, admission campaigns, advertising & promotion, website designing for schools
 
Teacher Recruitment Process:
1. Understanding client school requirements
2. Creating job descriptions
3. Sourcing candidates via advertisements and networks
4. Screening, interviews, background checks
5. Assessments: demo classes and written tests
6. Final selection → job offers → onboarding → continuous support
7. Feedback collection to improve future placements
 
Pricing - For Schools (Client Institutions):
- Service fee: ₹1500 total
- Payment: 50% (₹750) paid upfront, remaining 50% (₹750) after successful placement
 
Pricing - For Teachers (Candidates):
- Service fee: 50% of first month's salary
- Payment options: 
  1. One installment within 40 days
  2. Two installments over a defined period
 
Key Policies:
- Teachers must provide accurate information and attend interviews on time
- Both parties must maintain confidentiality
- Timely communication required from all parties
- Either party may terminate with prior notice
 
Your role:
- Answer queries about services, fees, process, and eligibility
- Collect contact details (name, phone, email, city, whether they are a school or teacher) when someone expresses interest
- Be warm, professional, and helpful
- Keep responses concise — 2-4 sentences typically
- If someone wants to connect with the team, ask for their name and contact number
 
Do NOT make up information not listed above. If unsure, say the team will get back to them.`;
 

const model = genAI.getGenerativeModel({ 
    model: "gemini-3.1-flash-lite-preview",
    systemInstruction: SYSTEM_PROMPT 
});

const conversationStore = {};

app.post("/api/chat", async (req, res) => {
    console.log('📨 Received chat request');
    const { message, sessionId } = req.body;
    console.log('Message:', message);
    console.log('SessionId:', sessionId);

    if (!message || !sessionId) {
        console.log('❌ Missing message or sessionId');
        return res.status(400).json({ error: "message and sessionId are required" });
    }

    if (!conversationStore[sessionId]) {
        conversationStore[sessionId] = [];
    }

    try {
        console.log('🤖 Calling Gemini API...');
        const history = conversationStore[sessionId].map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        const chat = model.startChat({ history });

        const result = await chat.sendMessage(message);
        const assistantMessage = result.response.text();
        console.log('✅ Got response from Gemini');

        conversationStore[sessionId].push({ role: "user", content: message });
        conversationStore[sessionId].push({ role: "assistant", content: assistantMessage });

        if (conversationStore[sessionId].length > 20) {
            conversationStore[sessionId] = conversationStore[sessionId].slice(-20);
        }

        res.json({ reply: assistantMessage, sessionId });

    } catch (error) {
        console.error("❌ Gemini API error:", error);
        console.error("Error details:", error.message);
        console.error("API Key present:", !!process.env.GEMINI_API_KEY);
        res.status(500).json({ error: "Failed to get response from AI", details: error.message });
    }
});

app.delete("/api/chat/:sessionId", (req, res) => {
    delete conversationStore[req.params.sessionId];
    res.json({ message: "Session cleared" });
});

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Maa Savitri Chatbot API (Gemini Powered)" });
});

const PORT = process.env.PORT || 5000;

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

app.listen(PORT, async () => {
    console.log(`Maa Savitri Chatbot server running on port ${PORT}`);
    console.log(`GEMINI_API_KEY loaded: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
    
    try {
        const testModel = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
        const result = await testModel.generateContent("Hello");
        console.log('✅ Gemini API connection successful');
    } catch (error) {
        console.error('❌ Gemini API test failed:', error.message);
    }
});
