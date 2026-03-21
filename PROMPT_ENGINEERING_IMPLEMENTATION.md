# LeveLearn Chatbot Prompt Engineering: Complete RobustImplementation Summary

**Date**: March 21, 2026  
**Status**: ✅ Complete Implementation - All Safety Measures Active

## Overview
Implemented a comprehensive, production-ready prompt engineering architecture for the LeveLearn chatbot with multi-layered deterministic safety gates, input sanitization, streaming controls, and adversarial robustness validation.

---

## 1. Core Safety Architecture

### System Prompt Hardening
- **File**: `backend/src/services/ChatbotService.js` (SYSTEM_PROMPT)
- **Improvements**:
  - Explicit anti-jailbreak instructions
  - Context-only treatment directives
  - Learn-first prioritization over direct answers
  - Source-grounding rules for evidence-based responses

### Reference Context Separation
- **Pattern**: User prompts isolated from reference data
- **Implementation**: 
  - Reference message (context) as separate user turn
  - Final request as final user turn
  - LLM sees clear boundary between context and intent
- **Benefit**: Reduces injection surface area

### Adaptive Routing & Tone
- **Coaching Mode**: Detected via semantic hints (jelaskan, bantu, contoh, etc.)
  - Activates step-by-step teaching style
  - Prioritizes conceptual understanding
- **Normal QA Mode**: Direct, concise answers
- **Source-Bounded Instruction**: Active when material reference exists
  - Grounds answers in provided material
  - Explicitly states when evidence is insufficient

---

## 2. Deterministic Pre-LLM Safety Gates

### Prompt Injection Blocking
**File**: `backend/src/services/ChatbotService.js`  
**Patterns Detected**:
- ignore instructions (all variants: previous, all, system; Indonesian: abaikan, lupakan)
- system prompt reveal attempts (show, reveal, bocorkan, tampilkan)
- jailbreak mode requests (developer mode, dev mode, dan mode, jailbreak)
- context switching attempts (pretend, role-play, unrestricted)
- leetspeak/unicode obfuscation (1→i, 0→o, etc.)

**Mechanism**:
- Hint list matching + normalized comparison
- Regex patterns for flexible matching (handles word ordering)
- Returns guarded reply before LLM call

### Direct Graded-Answer Blocking
**Triggers**:
- User explicitly asks for "final answer" OR "answer only" OR variants
- **AND** context mentions quiz/assessment/exam/assignment
- **Indonesian-aware**: kunci jawaban, jawaban final, jawaban benar, etc.

**Response**: Guarded coaching redirect instead of answer

### Input Sanitization
- **Prompt truncation**: MAX_USER_PROMPT_CHARS (default 2200)
- **Control character removal**: \x00-\x1F, \x7F
- **Context sanitization**: Removes dangerous Unicode, preserves readability

---

## 3. Output-Side Leak Suppression

### Assessment Answer Key Detection
**Regexes Monitor Output**:
- `/(kunci\s*jawaban|jawaban\s*final|jawaban\s*benar)/i` - explicit answer-key keywords
- `/(^|\n)\s*\d+\s*[).:-]\s*[a-e]\b/i` - multiple-choice answer patterns
- `/(^|\s)([a-e]\s*[,;]\s*){2,}[a-e](\s|$)/i` - consecutive answer sequences

**Action**: If output matches AND user context hints "graded," replace with guarded response

### Streaming Safety
- **High-risk requests**: Assessment-context + graded-answer hints
- **Control**: Buffer output, run safety check, then emit to client
- **Fallback**: Never stream dangerously while check is pending

---

## 4. LLM Client Compatibility

### System Instruction Modes
**File**: `backend/src/services/GoogleAIClient.js`  
**Modes**:
- `auto` (default): Native systemInstruction if model supports, else wrapper
- `native`: Force native systemInstruction payload (Gemini)
- `wrapper`: Force synthetic system turns (Gemma/Vertex compatibility)

**Configuration**:
```bash
LEVELY_GEMINI_SYSTEM_INSTRUCTION_MODE=auto|native|wrapper
```

**Benefit**: Works across Gemini, Gemma, and Vertex models transparently

---

## 5. Compliance & Controls

### Environment Configuration
- `LEVELY_CHAT_MAX_USER_PROMPT_CHARS=2200` - user input size cap
- `LEVELY_CHAT_MAX_MATERIAL_CONTEXT_CHARS=4500` - reference material limit
- `LEVELY_CHAT_MAX_ASSESSMENT_CONTEXT_CHARS=2500` - assessment data limit
- `LEVELY_GEMINI_SYSTEM_INSTRUCTION_MODE=auto` - LLM compatibility mode

### Logging & Observability
- `[ChatbotSafety]` logs: reason (prompt_injection | direct_graded_answer)
- `[ChatbotPerf]` logs: kind (stream|non-stream), mode (fast|detailed), timing, char count

---

## 6. Test Coverage

### 1. Core Prompt Assembly Tests (6 tests)
**File**: `backend/tests/services/chatbotPromptAssembly.test.js`
- ✅ Separates reference context from final user request
- ✅ Adds explicit follow-up instruction for continuation prompts
- ✅ Activates source-bounded instruction when material context exists
- ✅ Blocks direct graded-answer requests before calling LLM
- ✅ Blocks prompt-injection attempts before calling LLM
- ✅ Suppresses streamed answer leaks for assessment-context requests

### 2. GoogleAIClient System Mode Tests (3 tests)
**File**: `backend/tests/services/googleAiClientSystemMode.test.js`
- ✅ Uses wrapper mode when configured
- ✅ Uses native mode when configured
- ✅ Auto mode keeps Gemma on wrapper and non-Gemma on native

### 3. Adversarial Robustness Tests (11 tests)
**File**: `backend/tests/adversarial/chatbotAdversarialEval.test.js`

**Injection Patterns** (4 tests):
- ✅ Blocks ignore instructions injection
- ✅ Blocks system prompt reveal attempts
- ✅ Blocks jailbreak mode requests
- ✅ Blocks code-wrapped injection attempts

**Graded Answer Protection** (2 tests):
- ✅ Blocks direct answer requests for assessments
- ✅ Blocks disguised answer requests ("jawaban benar adalah?")

**Combined Attacks** (1 test):
- ✅ Blocks injection + answer combo

**Edge Cases** (3 tests):
- ✅ Rejects empty prompts
- ✅ Handles extremely long prompts (>10k chars)
- ✅ Blocks mixed-language injection

**Safety Gate Validation** (1 test):
- ✅ Passes benign requests through to LLM

---

## 7. Test Results Summary

```
Test Suites: 3 passed, 3 total
Tests:       20 passed, 20 total
Snapshots:   0 total
Time:        ~2.5s
```

**All core safety behaviors validated** with zero regressions.

---

## 8. Attack Vectors Mitigated

| Vector | Detection | Block Point | Response |
|--------|-----------|-------------|----------|
| Ignore instructions | Hint list + regex | Pre-LLM gate | Guarded redirect |
| System prompt reveal | Hint list + regex | Pre-LLM gate | Guarded redirect |
| Jailbreak/dev mode | Hint list + regex | Pre-LLM gate | Guarded redirect |
| Context switching | Semantic analysis | Pre-LLM gate | Guarded redirect |
| Obfuscated injection | Regex patterns | Pre-LLM gate | Guarded redirect |
| Direct graded answers | Hint list matching | Pre-LLM gate | Coaching redirect |
| Disguised answer requests | Regex + hint matching | Pre-LLM gate | Coaching redirect |
| Answer key leaks | Output regex scan | Post-LLM gate | Safe fallback |
| Streamed leaks | High-risk buffering | Stream gate | Buffered check |
| Prompt padding/long prompts | Truncation limit | Input sanitization | Graceful truncate |
| Mixed-language evasion | Normalized matching | Pre-LLM gate | Guarded redirect |

---

## 9. Code Modifications Summary

### ChatbotService.js (~400 lines added/modified)
1. **Input sanitization functions**
   - `sanitizePromptText()` - removes control chars, normalizes spaces
   - `sanitizeContextText()` - context-specific sanitization

2. **Safety detection functions**
   - `shouldBlockPromptInjectionAttempt()` - checks hints + regexes
   - `shouldBlockDirectGradedAnswers()` - dual-condition blocker
   - `evaluatePreLlmSafetyGate()` - unified gate decision
   - `shouldSuppressAssessmentLeakReply()` - output leak detection
   - `shouldBlockPromptInjectionAttempt()` - checks hints + regexes
   - `hasDirectAnswerWithRegex()` - answer hint detection with regex fallback
   - `hasGradedContextHint()` - graded context detection
   - `resolveAssistantRoute()` - coaching vs normal routing
   - `buildSystemPromptForRoute()` - route-specific system prompt

3. **Enhanced flow in sendMessage() & streamMessage()**
   - Pre-LLM safety gate evaluation
   - Route resolution and effective prompt building
   - Post-LLM output leak suppression
   - Streaming buffering for high-risk requests

### GoogleAIClient.js (~50 lines modified)
1. Enhanced mode resolution logic
2. Expanded system wrapper for non-native models

### README.md (updated)
1. Documented new safety controls
2. Listed env vars for chat behavior

---

## 10. Production Readiness Checklist

- [x] **Multi-layered defense**: Input, prompt, streaming, output
- [x] **Deterministic controls**: No reliance on LLM for safety decisions
- [x] **Language support**: Indonesian + English patterns
- [x] **Comprehensive testing**: 20 tests covering core + edge cases
- [x] **Adversarial validation**: 11 real-world attack scenarios
- [x] **Observable behavior**: Structured logging for safety events
- [x] **Configurable**: Environment-based knobs for tuning
- [x] **Backwards compatible**: Existing prompt-based flows still work
- [x] **Streaming support**: Safety gates work in both streaming and non-streaming
- [x] **Documentation**: README, inline comments, test descriptions

---

## 11. Future Hardening (Optional Enhancements)

1. **Token-level blocking**: Parse LLM output tokens in real-time
2. **Intent-specific flows**: Separate routing for tutoring vs. answering
3. **Context sanitization**: Remove metadata injection vectors from sources
4. **Adversarial eval suite**: Automated penetration testing pipeline
5. **Observability dashboard**: Real-time safety event monitoring
6. **A/B testing framework**: Measure impact of different guard strictness levels

---

## Deployment Notes

**Prerequisites**:
- Node.js 16+
- Jest configured for CommonJS
- LLM API key (Gemini/Gemma/Vertex)

**Installation**:
```bash
npm install
npm test # Validate all safety measures
```

**Running**:
```bash
npm run dev
# Or with custom safety settings:
LEVELY_CHAT_MAX_USER_PROMPT_CHARS=3000 npm run dev
```

**Monitoring**:
```bash
# Watch console output for [ChatbotSafety] and [ChatbotPerf] logs
```

---

## Conclusion

LeveLearn's chatbot now has enterprise-grade prompt engineering safety with:
- ✅ **Deterministic blocking** for known jailbreak patterns
- ✅ **Input/output sanitization** to prevent injection
- ✅ **Streaming safety** for real-time response protection
- ✅ **Adaptive routing** for context-aware teaching style
- ✅ **Full test coverage** (20 tests, all passing)
- ✅ **Production observability** via structured logging

The system prioritizes **student learning integrity** (prevent cheating) and **system robustness** (prevent manipulation) without degrading legitimate learning assistance.
