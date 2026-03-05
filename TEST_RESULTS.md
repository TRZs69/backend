# ELO Rating System - Test Results and Analysis

This document outlines the raw results of the Jest unit tests for the ELO rating system, along with a detailed explanation of what each test case evaluates and what its successful execution implies for the `Levelearn` platform.

## Raw Test Output

```text
 PASS  tests/utils/clampElo.test.js
 PASS  tests/utils/calculateQuestionDuelElo.test.js

  clampElo() - Ensuring ELO stays within bounds
      √ should return the original value if it falls within min and max bounds
      √ should return DEFAULT_ELO if the value is strictly below MIN_ELO
      √ should return DEFAULT_ELO if the value is strictly above MAX_ELO 
      √ should parse strings into integers successfully
      √ should handle invalid string inputs by returning DEFAULT_ELO
      √ should handle falsy/null inputs by returning DEFAULT_ELO

  calculateQuestionDuelElo() - Calculating new ELOs based on answers
      √ should correctly increase user ELO and decrease question ELO when a student answers correctly
      √ should correctly decrease user ELO and increase question ELO when a student answers incorrectly
      √ should not allow user or question ELO to fall below MIN_ELO after calculations
      √ should correctly calculate expected values when ELO disparity is massive

Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        1.286 s
Ran all test suites.
```

---

## Detailed Test Case Analysis

### 1. `clampElo()` Test Suite
This suite verifies that the `clampElo` utility safely handles input limits and sanitization.

**Test Case:** `should return the original value if it falls within min and max bounds`
* **What was tested:** We fed a valid ELO of `1500` (which is safely between 750 and 3000) into the function.
* **What it tells us:** The system does not alter valid data. Safe ELO values correctly pass through the filter untouched.

**Test Case:** `should return DEFAULT_ELO if the value is strictly below MIN_ELO`
* **What was tested:** We fed an ELO of `650` (which is under the 750 minimum).
* **What it tells us:** If a rating drops illegally low due to a database error or manual tampering, the system catches it and resets the rating to the default base line of `1200` to prevent system breakdown.

**Test Case:** `should return DEFAULT_ELO if the value is strictly above MAX_ELO`
* **What was tested:** We fed an ELO of `3100` (which is above the 3000 absolute limit).
* **What it tells us:** The system protects against runaway accounts or hacked scores by resetting illegally high scores back to the base `1200`.

**Test Case:** `should parse strings into integers successfully`
* **What was tested:** We fed stringified numerical data (`"1450"`) into the function.
* **What it tells us:** Data payloads sent across HTTP from the frontend, or parsed as Strings from the database, won't break the system; they are accurately converted back into stable integers.

**Test Case:** `should handle invalid string inputs / falsy / null by returning DEFAULT_ELO`
* **What was tested:** We supplied corrupt data, alphabetic strings (`"invalid_string"`), `null`, and `undefined`.
* **What it tells us:** The function is completely failure-resistant. Missing or fundamentally broken incoming data defaults safely to a neutral `1200` rating without throwing a fatal server error.

---

### 2. `calculateQuestionDuelElo()` Test Suite
This suite verifies the core reward and penalty algorithms that power the application's gamified learning environment.

**Test Case:** `should correctly increase user ELO and decrease question ELO when a student answers correctly`
* **What was tested:** We simulated a duel where both User and Question had equal ELO (`1500`) and the user supplied a `Correct` answer.
* **What it tells us:** The core reward mechanism functions appropriately. When a student learns and succeeds, they are accurately rewarded with points, and the question is proven "slightly easier" than previously thought, lowering its ELO to balance the question pool.

**Test Case:** `should correctly decrease user ELO and increase question ELO when a student answers incorrectly`
* **What was tested:** We simulated the same duel (`1500` vs `1500`), but the student answered `Incorrectly`.
* **What it tells us:** The penalty mechanism is accurate. Failing a question docks points from the user, while raising the question's ELO because it proved tough enough to trick a student of that rank.

**Test Case:** `should not allow user or question ELO to fall below MIN_ELO after calculations`
* **What was tested:** We forced a situation where a user was already at the rock-bottom `750` ELO and failed a question, which theoretically requires them to lose points.
* **What it tells us:** The mathematical floor calculation (`Math.max()`) works successfully. Players can never get "negative" points or fall below `750` even if they fail repeatedly. The system is punishing but ultimately fair and bounded.

**Test Case:** `should correctly calculate expected values when ELO disparity is massive`
* **What was tested:** A weak user (`1200 ELO`) correctly answered a brutally hard question (`1800 ELO`).
* **What it tells us:** The expected probability equation (`1 / (1 + 10^((Q - U)/400))`) correctly assesses that the user had almost 0% chance of winning. Because they overcame the odds, the algorithm accurately awarded them a massive spike in points (nearly the full 30 max `K_USER` multiplier). It tells us the difficulty scaling is accurately calibrated.
