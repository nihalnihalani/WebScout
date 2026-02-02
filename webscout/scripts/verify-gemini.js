const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// Load env vars manually to ensure we catch .env.local
try {
    const envLocal = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    envLocal.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
} catch (e) {
    console.log("Could not read .env.local");
}

const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
    console.error("❌ GOOGLE_AI_API_KEY not found in environment or .env.local");
    process.exit(1);
}

console.log(`✅ Found API Key: ${apiKey.substring(0, 4)}...`);
console.log(`   Length: ${apiKey.length}`);
console.log(`   First char code: ${apiKey.charCodeAt(0)}`);
console.log(`   Last char code: ${apiKey.charCodeAt(apiKey.length - 1)}`);

if (apiKey.includes(' ') || apiKey.includes('\n') || apiKey.includes('\r')) {
    console.warn("⚠️  WARNING: Key contains whitespace/newlines!");
}

async function testModel(modelName) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    try {
        const result = await model.generateContent("Hello, world!");
        console.log(`✅ Model ${modelName} is WORKING! Response: ${result.response.text()}`);
        return true;
    } catch (error) {
        console.error(`❌ Model ${modelName} failed: ${error.message}`);
        return false;
    }
}

(async () => {
    console.log("Testing Gemini Models...");
    // Test the model user asked about
    await testModel("gemini-3-flash-preview");
    // Test the model currently in code
    await testModel("gemini-2.0-flash");

    console.log("\nTesting Raw HTTP Request...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
        });
        const data = await response.json();
        if (response.ok) {
            console.log("✅ Raw HTTP Request SUCCESS! Key is valid.");
        } else {
            console.error("❌ Raw HTTP Request FAILED:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("❌ Raw HTTP Request Exception:", e.message);
    }
})();
