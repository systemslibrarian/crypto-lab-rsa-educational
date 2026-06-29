# Prompt: Create "crypto-lab-rsa-educational" Demo

You are an expert cryptography educator and frontend developer who creates high-quality, focused, interactive browser-based educational tools.

## Project Goal
Create a new standalone browser demo called **Educational RSA** that gives students a clear, step-by-step understanding of how RSA works in practice using small numbers, while also showing why it becomes secure at real-world key sizes.

## Why This Is Valuable for Students
RSA is one of the most taught public-key cryptosystems in university courses, yet many students struggle to connect the mathematical description (modular exponentiation, Euler’s totient, etc.) with how it actually behaves as a working cryptosystem. 

A good educational demo should allow students to:
- See key generation, encryption, decryption, and signing with real (but small) numbers
- Understand why small keys are completely broken
- Develop intuition for why RSA is secure at 2048+ bits without needing to fully understand the number theory
- Appreciate the difference between textbook RSA and real-world RSA (padding, etc.)

This type of interactive “see it working” experience is difficult to achieve with static slides or textbooks.

## Learning Objectives
By using this demo, a student should be able to:
- Walk through RSA key generation step by step
- Encrypt and decrypt a message using RSA
- Sign a message and verify the signature
- Explain why small RSA keys are insecure (factoring)
- Understand the role of padding (OAEP) and why textbook RSA is dangerous
- Describe the computational difficulty of factoring large numbers vs multiplying two primes

## Required Sections & Flow

### 1. Quick RSA Overview
- Short, clear explanation of the core idea: “Multiply two primes is easy. Factoring the product is hard.”
- Visual or simple diagram of public key (n, e) and private key (d).

### 2. Interactive Key Generation
- User can choose two small primes (or have them generated).
- Show the step-by-step calculation of n, φ(n), e, and d.
- Option to see what happens when primes are too small or not random enough.

### 3. Encryption & Decryption Playground
- User enters a short message (or number).
- Encrypt it with the public key.
- Decrypt it with the private key.
- Show the math happening under the hood (modular exponentiation) in an understandable way.

### 4. Signing & Verification
- User signs a message with the private key.
- Anyone can verify it with the public key.
- Show how signature forgery becomes infeasible as key size grows.

### 5. “What Breaks at Scale” Section
- Side-by-side comparison:
  - Small key (easily factorable in the browser)
  - Realistic key size (2048-bit) — show that factoring becomes computationally infeasible
- Simple visualization or explanation of factoring difficulty growth.

### 6. Real-World RSA Warnings
- Brief but important section on why raw/textbook RSA is dangerous.
- Show the effect of proper padding (OAEP) vs no padding.
- Mention common real-world pitfalls (Bleichenbacher attack, etc.) at a high level.

## Technical Preferences
- Browser-native (HTML + TypeScript/JavaScript). WASM is acceptable for big-integer operations if needed for realism.
- Default to very small primes for clarity and interactivity.
- Provide a “Realistic size” mode that uses larger numbers (even if operations are slower or simulated).
- Clean, educational aesthetic consistent with other Crypto Lab demos.
- Strong focus on step-by-step visibility and user control.

## Relationship to Existing Work
- This should complement (not duplicate) any existing RSA-related content (e.g., RSA Forge attack demo).
- The focus here is **educational understanding**, not attacking RSA.
- It can link to more advanced demos (e.g., attacks on RSA, post-quantum alternatives) where appropriate.

## Output Requested
Please provide:
1. A recommended final display title for the demo page
2. High-level architecture and component breakdown
3. Key interactive elements and how they should behave
4. Suggested visualizations and UI layout
5. Important pedagogical notes (especially around number size and padding)
6. Any technical challenges (big integers in browser, performance) and recommended solutions

Start with the proposed structure, then we can iterate on implementation details.
