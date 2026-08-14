# RF ONLINE NEXT Helper

A simple unofficial helper web application for **RF ONLINE NEXT**, built with **Next.js**.

The initial version of this project provides:

1. Diamond Tax Calculator
2. Material Conversion Calculator
3. Material Conversion Point Breakdown
4. Material Eligibility Validation

Official Material Conversion reference:

https://guide.netmarble.com/rfnext/177

---

# 1. Project Goal

Build a simple, fast, responsive RF ONLINE NEXT helper website.

The application should help players calculate:

- Diamond received after market tax.
- Material Conversion points.
- Whether selected equipment can be used for Material Conversion.
- Total conversion points from 4–6 equipment pieces.
- Point contribution from each individual material.

This project does NOT need:

- Authentication
- Database
- Backend API
- User accounts
- Persistent server storage

Everything can run client-side.

Use localStorage only if we later want to remember user preferences.

---

# 2. Tech Stack

Use:

- Next.js latest stable version
- App Router
- TypeScript
- React
- Tailwind CSS
- Lucide React for icons

Do NOT introduce unnecessary libraries.

Prefer native React state and reusable components.

Recommended:

```bash
npx create-next-app@latest rf-next-helper
```

Configuration:

```text
TypeScript: Yes
ESLint: Yes
Tailwind CSS: Yes
src directory: Yes
App Router: Yes
Turbopack: Yes
```

---

# 3. Project Branding

Application name:

```text
RF NEXT Helper
```

Subtitle:

```text
Unofficial tools for RF ONLINE NEXT players
```

The website must clearly state that this is an unofficial community tool and is not affiliated with Netmarble.

Do NOT copy proprietary game artwork.

Use an original sci-fi inspired interface.

Suggested visual direction:

- Dark background
- Futuristic / sci-fi UI
- Subtle borders
- Slight glow effects
- Clean cards
- Mobile friendly
- Desktop friendly

Avoid excessive animations.

---

# 4. Main Navigation

For V1, use one page.

Example:

```text
RF NEXT Helper

[ Diamond Tax ]
[ Material Conversion ]
```

Tabs or cards are acceptable.

Recommended layout:

```text
Header
 ├── Logo / RF NEXT Helper
 └── Unofficial Helper badge

Main
 ├── Diamond Tax Calculator
 └── Material Conversion Calculator

Footer
 ├── Data source
 └── Unofficial disclaimer
```

---

# 5. Diamond Tax Calculator

## Business Rule

Market tax is always:

```text
8%
```

The user enters the listed/selling Diamond amount.

Calculate:

```ts
const TAX_RATE = 0.08;

const tax = diamond * TAX_RATE;
const receivedDiamond = diamond - tax;
```

Because Diamonds should be displayed as whole numbers, V1 should use:

```ts
const receivedDiamond = Math.floor(diamond * 0.92);
const tax = diamond - receivedDiamond;
```

Keep the tax constant in one location:

```ts
export const DIAMOND_TAX_RATE = 0.08;
```

Do NOT hardcode `0.08` in multiple components.

---

## Example

Input:

```text
10,000 Diamond
```

Result:

```text
Selling Price
10,000

Market Tax
800

You Receive
9,200
```

Another example:

```text
Selling Price: 25,000
Tax 8%: 2,000
Receive: 23,000
```

---

# 6. Diamond Calculator UI

Create a card:

```text
Diamond Tax Calculator

Selling Price
[ 10,000 ]

Market Tax
8%

--------------------------------

Tax
800 Diamond

You Receive
9,200 Diamond
```

The "You Receive" amount should be visually emphasized.

Calculation must update instantly as the user types.

Input requirements:

- Numeric only
- Minimum 0
- Format thousands separator visually
- No negative values

Provide quick amount buttons:

```text
1K
5K
10K
25K
50K
100K
```

When clicked, immediately update the calculator.

---

# 7. Material Conversion

Material Conversion logic must follow the official RF ONLINE NEXT guide:

https://guide.netmarble.com/rfnext/177

Important rules:

1. Only Rare grade or higher equipment can be used.
2. Equipment must be Unbound.
3. Bound equipment cannot be used.
4. Prime equipment can be used.
5. Enhanced equipment can be used.
6. Minimum materials per conversion = 4.
7. Maximum materials per conversion = 6.
8. Conversion points depend on:
   - Grade
   - Prime status
   - Tier
   - Enhancement level
9. Total material points determine the Material Conversion Level.
10. The official public guide does NOT provide enough data to calculate every Conversion Level threshold.
11. Therefore DO NOT invent Conversion Level thresholds.
12. The tool should calculate TOTAL MATERIAL POINTS only.
13. Display Conversion Level as "Check in-game" unless official threshold data is added later.

---

# 8. Supported Equipment

V1 supports:

```text
Rare
Prime Rare
Epic
Prime Epic
```

Rare equipment supports:

```text
Tier 1 - Tier 8
```

Epic equipment supports:

```text
Tier 1 - Tier 5
```

Do not allow Epic T6-T8 because the official guide does not provide point values for those tiers.

---

# 9. Material Slots

The calculator should behave similarly to the game.

Maximum:

```text
6 material slots
```

Minimum required for conversion:

```text
4 material slots
```

Each slot represents ONE equipment piece.

Example:

```text
Material #1
Rare
Tier 5
+5
Unbound
100 Points

Material #2
Rare
Tier 5
+5
Unbound
100 Points

Material #3
Rare
Tier 5
+5
Unbound
100 Points

Material #4
Rare
Tier 5
+5
Unbound
100 Points

TOTAL
400 Points
```

Provide:

```text
+ Add Material
```

until there are 6 slots.

Each slot should have a Delete / Remove button.

---

# 10. Material Input Fields

Each material slot requires:

## Grade

Select:

```text
Rare
Epic
```

## Prime

Toggle:

```text
Prime: Yes / No
```

Internally this produces:

```text
Rare
Prime Rare
Epic
Prime Epic
```

## Tier

Rare:

```text
T1
T2
T3
T4
T5
T6
T7
T8
```

Epic:

```text
T1
T2
T3
T4
T5
```

## Enhancement Level

```text
+1
+2
+3
...
+15
```

## Binding

```text
Unbound
Bound
```

If Bound:

```text
This equipment cannot be used for Material Conversion.
```

Set point contribution to:

```text
0
```

and mark the material as invalid.

---

# 11. Official Material Conversion Points

DO NOT calculate these points using guessed formulas.

Use an explicit lookup table based on official Netmarble values.

Create:

```text
src/data/material-conversion-points.ts
```

Recommended types:

```ts
export type EquipmentGrade = "rare" | "primeRare" | "epic" | "primeEpic";

export type EnhancementGroup = "1-5" | "6-7" | "8-10" | "11-14" | "15";
```

Helper:

```ts
export function getEnhancementGroup(enhancement: number): EnhancementGroup {
  if (enhancement >= 1 && enhancement <= 5) {
    return "1-5";
  }

  if (enhancement >= 6 && enhancement <= 7) {
    return "6-7";
  }

  if (enhancement >= 8 && enhancement <= 10) {
    return "8-10";
  }

  if (enhancement >= 11 && enhancement <= 14) {
    return "11-14";
  }

  return "15";
}
```

---

# 12. Rare Point Table

Use exactly:

```ts
export const RARE_POINTS = {
  "1-5": {
    1: 10,
    2: 30,
    3: 50,
    4: 75,
    5: 100,
    6: 150,
    7: 200,
    8: 250,
  },

  "6-7": {
    1: 11,
    2: 33,
    3: 55,
    4: 83,
    5: 110,
    6: 165,
    7: 220,
    8: 275,
  },

  "8-10": {
    1: 12,
    2: 36,
    3: 60,
    4: 90,
    5: 120,
    6: 180,
    7: 240,
    8: 300,
  },

  "11-14": {
    1: 13,
    2: 39,
    3: 65,
    4: 98,
    5: 130,
    6: 195,
    7: 260,
    8: 325,
  },

  "15": {
    1: 14,
    2: 42,
    3: 70,
    4: 105,
    5: 140,
    6: 210,
    7: 280,
    8: 350,
  },
} as const;
```

---

# 13. Prime Rare Point Table

```ts
export const PRIME_RARE_POINTS = {
  "1-5": {
    1: 15,
    2: 45,
    3: 75,
    4: 113,
    5: 150,
    6: 225,
    7: 300,
    8: 375,
  },

  "6-7": {
    1: 17,
    2: 50,
    3: 83,
    4: 124,
    5: 165,
    6: 248,
    7: 330,
    8: 413,
  },

  "8-10": {
    1: 18,
    2: 54,
    3: 90,
    4: 135,
    5: 180,
    6: 270,
    7: 360,
    8: 450,
  },

  "11-14": {
    1: 20,
    2: 59,
    3: 98,
    4: 146,
    5: 195,
    6: 293,
    7: 390,
    8: 488,
  },

  "15": {
    1: 21,
    2: 63,
    3: 105,
    4: 158,
    5: 210,
    6: 315,
    7: 420,
    8: 525,
  },
} as const;
```

---

# 14. Epic Point Table

Epic only supports T1-T5 in the official table.

```ts
export const EPIC_POINTS = {
  "1-5": {
    1: 400,
    2: 700,
    3: 1200,
    4: 2000,
    5: 3800,
  },

  "6-7": {
    1: 440,
    2: 770,
    3: 1320,
    4: 2200,
    5: 4180,
  },

  "8-10": {
    1: 480,
    2: 840,
    3: 1440,
    4: 2400,
    5: 4560,
  },

  "11-14": {
    1: 520,
    2: 910,
    3: 1560,
    4: 2600,
    5: 4940,
  },

  "15": {
    1: 560,
    2: 980,
    3: 1680,
    4: 2800,
    5: 5320,
  },
} as const;
```

---

# 15. Prime Epic Point Table

```ts
export const PRIME_EPIC_POINTS = {
  "1-5": {
    1: 600,
    2: 1050,
    3: 1800,
    4: 3000,
    5: 5700,
  },

  "6-7": {
    1: 660,
    2: 1155,
    3: 1980,
    4: 3300,
    5: 6270,
  },

  "8-10": {
    1: 720,
    2: 1260,
    3: 2160,
    4: 3600,
    5: 6840,
  },

  "11-14": {
    1: 780,
    2: 1365,
    3: 2340,
    4: 3900,
    5: 7410,
  },

  "15": {
    1: 840,
    2: 1470,
    3: 2520,
    4: 4200,
    5: 7980,
  },
} as const;
```

These numbers should be treated as source-of-truth data.

Do not recalculate them with multipliers because some official values involve rounding.

---

# 16. Point Calculator

Create:

```text
src/lib/material-conversion.ts
```

Suggested function:

```ts
type CalculateMaterialPointsInput = {
  grade: "rare" | "epic";
  prime: boolean;
  tier: number;
  enhancement: number;
  bound: boolean;
};

export function calculateMaterialPoints(
  equipment: CalculateMaterialPointsInput,
): number {
  if (equipment.bound) {
    return 0;
  }

  const group = getEnhancementGroup(equipment.enhancement);

  if (equipment.grade === "rare") {
    const table = equipment.prime ? PRIME_RARE_POINTS : RARE_POINTS;

    return table[group][equipment.tier as keyof (typeof table)[typeof group]];
  }

  const table = equipment.prime ? PRIME_EPIC_POINTS : EPIC_POINTS;

  return table[group][equipment.tier as keyof (typeof table)[typeof group]];
}
```

Improve TypeScript typing as necessary.

Avoid `any`.

---

# 17. Total Conversion Points

Total:

```ts
const totalPoints = materials.reduce(
  (total, material) => total + calculateMaterialPoints(material),
  0,
);
```

Also calculate:

```ts
const validMaterialCount = materials.filter(
  (material) => !material.bound,
).length;
```

Conversion is ready only if:

```ts
validMaterialCount >= 4 && validMaterialCount <= 6;
```

---

# 18. Conversion Validation

Possible states:

## Less than 4 Materials

Show:

```text
Add at least 4 eligible materials.
```

Status:

```text
Not Ready
```

---

## 4–6 Valid Materials

Show:

```text
Material selection is valid.
```

Status:

```text
Ready
```

---

## Bound Material

Show:

```text
Bound equipment cannot be used for Material Conversion.
```

Highlight that slot.

It should NOT contribute points.

---

## Maximum Materials

When already at 6 materials:

Disable:

```text
+ Add Material
```

Display:

```text
Maximum 6 materials per conversion.
```

---

# 19. Material Conversion Result Card

Example:

```text
Conversion Summary

Materials
6 / 6

Total Conversion Points
600 P

Conversion Status
Ready

Conversion Level
Check in-game
```

Then point breakdown:

```text
#1 Rare T5 +5
100 P

#2 Rare T5 +5
100 P

#3 Rare T5 +5
100 P

#4 Rare T5 +5
100 P

#5 Rare T5 +5
100 P

#6 Rare T5 +5
100 P
```

---

# 20. Example Calculations

These cases are useful both for UI examples and unit tests.

## Example A

```text
Rare T5 +5
```

Expected:

```text
100 P
```

---

## Example B

```text
Rare T5 +8
```

Expected:

```text
120 P
```

---

## Example C

```text
Prime Rare T5 +9
```

Expected:

```text
180 P
```

---

## Example D

```text
Epic T2 +5
```

Expected:

```text
700 P
```

---

## Example E

```text
Epic T2 +6
```

Expected:

```text
770 P
```

---

## Example F

Six:

```text
Epic T2 +5
```

Calculation:

```text
700 × 6
```

Expected:

```text
4,200 P
```

---

## Example G

Six:

```text
Rare T5 +5
```

Calculation:

```text
100 × 6
```

Expected:

```text
600 P
```

---

# 21. Material Conversion Information

Below the calculator, create a collapsible:

```text
How Material Conversion Works
```

Explain briefly:

```text
Material Conversion requires between 4 and 6 Rare-grade
or higher Unbound equipment pieces.

Each piece contributes Material Conversion Points based on:

- Grade
- Tier
- Prime status
- Enhancement level

The combined points determine the Material Conversion Level
inside RF ONLINE NEXT.
```

Also explain:

```text
The game can predict 6 possible conversion results.

Predictions cost currency and can be repeated.

When the player performs the conversion, one of the
6 predicted items will be obtained.
```

Do NOT implement reward probability simulation yet.

---

# 22. Important Conversion Reward Information

Provide an information box:

```text
Special Conversion Rewards

According to the official guide, some Circlet equipment,
exclusive collection items, and Memory Chip items can only
be obtained through Material Conversion.
```

Do not invent which items are available at each point level.

---

# 23. Conversion Level Limitation

This is important.

The official public guide explains:

```text
Total Points -> Material Conversion Level
```

However, it does NOT publish enough threshold data to reliably implement:

```text
400 points = Level X
600 points = Level Y
...
```

Therefore DO NOT create fake rules such as:

```ts
if (points >= 400) return 3;
```

unless we later provide verified in-game threshold data.

For V1 display:

```text
Total Points: 600 P
Conversion Level: Check in-game
```

This prevents incorrect information.

Structure the application so that Conversion Level thresholds
can easily be added later.

For example:

```text
src/data/conversion-levels.ts
```

Future structure:

```ts
export const CONVERSION_LEVELS = [
  // Add verified thresholds here later.
];
```

---

# 24. Future Reward Probability Feature

Prepare architecture for a future feature but DO NOT implement fake data.

Future data could look like:

```ts
type ConversionReward = {
  name: string;
  probability: number;
  grade?: string;
};

type ConversionLevel = {
  level: number;
  minPoints: number;
  maxPoints?: number;
  rewards: ConversionReward[];
};
```

Only populate this when verified data is available.

---

# 25. Quick Material Presets

Add a convenient feature.

Inside Material Conversion, provide:

```text
Quick Add
```

Example:

```text
Rare T5
Epic T2
```

When clicking Rare T5:

Add:

```text
Rare
Tier 5
+1
Unbound
Non-Prime
```

The user can modify enhancement afterward.

When clicking Epic T2:

Add:

```text
Epic
Tier 2
+1
Unbound
Non-Prime
```

Do not exceed 6 slots.

---

# 26. Duplicate Material

Each material slot should have:

```text
Duplicate
```

For example the user creates:

```text
Epic T2 +5
```

Then clicks Duplicate 5 times.

Result:

```text
Epic T2 +5 x6
Total: 4,200 P
```

This is important because players frequently convert multiple identical items.

Disable Duplicate if there are already 6 materials.

---

# 27. Reset Button

Provide:

```text
Reset
```

Reset should clear all material slots.

Do not require confirmation because the calculator does not store valuable data.

---

# 28. Suggested Material Conversion UI

Desktop:

```text
┌─────────────────────────────────────────────────────────────┐
│ Material Conversion Calculator                             │
│ Calculate your equipment conversion points                 │
├──────────────────────────────────┬──────────────────────────┤
│ MATERIALS                        │ CONVERSION SUMMARY       │
│                                  │                          │
│ Rare · T5 · +5                   │ Materials                │
│ Prime: No                        │ 6 / 6                    │
│ Unbound                          │                          │
│                           100 P  │ Total Points             │
│                                  │ 600 P                    │
│ Rare · T5 · +5                   │                          │
│                           100 P  │ Status                   │
│                                  │ READY                    │
│ ...                              │                          │
│                                  │ Conversion Level         │
│ + Add Material                   │ Check in-game            │
└──────────────────────────────────┴──────────────────────────┘
```

Mobile:

Stack vertically:

```text
Material Calculator

Material #1
Material #2
Material #3
Material #4

+ Add Material

Conversion Summary
600 Points
Ready
```

---

# 29. Material Card Design

Each card should show a compact title.

Example:

```text
RARE T5 +8
120 P
```

Fields can be edited below.

Use visual grade distinction.

Suggested:

```text
Rare = subtle blue accent
Epic = subtle purple accent
```

Do not make color the only way to distinguish grade.

Always show text:

```text
Rare
Epic
```

---

# 30. Recommended Folder Structure

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── layout/
│   │   ├── header.tsx
│   │   └── footer.tsx
│   │
│   ├── diamond/
│   │   └── diamond-tax-calculator.tsx
│   │
│   └── conversion/
│       ├── material-conversion-calculator.tsx
│       ├── material-card.tsx
│       ├── material-form.tsx
│       ├── conversion-summary.tsx
│       └── conversion-info.tsx
│
├── data/
│   ├── material-conversion-points.ts
│   └── conversion-levels.ts
│
├── lib/
│   ├── diamond-tax.ts
│   ├── material-conversion.ts
│   └── format.ts
│
└── types/
    └── material.ts
```

Keep components reasonably small.

Do not put all logic inside `page.tsx`.

---

# 31. Diamond Utility

Create:

```text
src/lib/diamond-tax.ts
```

Example:

```ts
export const DIAMOND_TAX_RATE = 0.08;

export function calculateDiamondTax(diamond: number) {
  const gross = Math.max(0, diamond);

  const net = Math.floor(gross * (1 - DIAMOND_TAX_RATE));

  const tax = gross - net;

  return {
    gross,
    tax,
    net,
    taxRate: DIAMOND_TAX_RATE,
  };
}
```

---

# 32. Formatting Utility

Create:

```text
src/lib/format.ts
```

Example:

```ts
export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
```

Examples:

```text
4200 -> 4,200
100000 -> 100,000
```

---

# 33. Suggested Material Type

```ts
export type MaterialGrade = "rare" | "epic";

export type MaterialItem = {
  id: string;
  grade: MaterialGrade;
  prime: boolean;
  tier: number;
  enhancement: number;
  bound: boolean;
};
```

Use `crypto.randomUUID()` for IDs in client components if appropriate.

---

# 34. Conversion Summary Type

Optional:

```ts
export type ConversionSummary = {
  materialCount: number;
  validMaterialCount: number;
  totalPoints: number;
  ready: boolean;
};
```

---

# 35. Unit Tests

If adding tests, prioritize business logic.

Test:

```text
Diamond:
10,000 -> 800 tax -> 9,200 net

Rare T5 +5:
100 P

Rare T5 +8:
120 P

Prime Rare T5 +9:
180 P

Epic T2 +5:
700 P

Epic T2 +6:
770 P

Prime Epic T2 +15:
1,470 P

6x Epic T2 +5:
4,200 P

Bound Epic T2 +5:
0 P
```

Validation:

```text
3 materials -> Not Ready
4 materials -> Ready
6 materials -> Ready
7 materials -> impossible from UI
```

---

# 36. UX Requirements

Important:

- Calculation updates instantly.
- No submit button required.
- Never reload page during calculation.
- Responsive.
- Mobile-first.
- Inputs easy to use.
- Points clearly visible.
- Total conversion points should be the strongest visual element.
- Diamond received amount should be the strongest visual element in Diamond Calculator.
- Invalid materials must clearly show why they are invalid.

Use tooltips only when useful.

---

# 37. Empty State

Initial Material Conversion state can start with 4 empty/default materials because the game requires minimum 4.

Recommended defaults:

```text
Material 1: Rare T1 +1 Unbound
Material 2: Rare T1 +1 Unbound
Material 3: Rare T1 +1 Unbound
Material 4: Rare T1 +1 Unbound
```

Alternative:

Start empty and require Add Material.

Preferred UX:

Start with 4 material cards because it mirrors the minimum conversion requirement.

---

# 38. URL / SEO

Metadata:

```ts
title: "RF NEXT Helper - Diamond Tax & Material Conversion";

description: "Unofficial RF ONLINE NEXT calculator for Diamond market tax and Material Conversion points.";
```

Suggested future domain:

```text
rfnext-helper.example.com
```

No specific production domain is required for V1.

---

# 39. Footer Disclaimer

Include:

```text
RF NEXT Helper is an unofficial community tool and is not
affiliated with or endorsed by Netmarble.

Material Conversion data is based on the official
RF ONLINE NEXT game guide and may change when the game is updated.
```

Source link:

```text
https://guide.netmarble.com/rfnext/177
```

Open source link in a new tab.

---

# 40. Development Priorities

Implement in this order.

## Phase 1

Build:

```text
Layout
Header
Diamond Tax Calculator
```

Verify:

```text
10,000 Diamond -> 9,200 Diamond
```

## Phase 2

Create the Material Conversion point dataset.

Verify several official examples.

## Phase 3

Build Material Conversion material slots.

Support:

```text
Rare
Prime Rare
Epic
Prime Epic
Tier
Enhancement
Bound / Unbound
```

## Phase 4

Build total point calculation.

Support 4–6 materials.

## Phase 5

Improve UI and responsive layout.

## Phase 6

Add tests.

---

# 41. Acceptance Criteria

The project is complete when:

- [ ] Next.js application starts successfully.
- [ ] TypeScript has no errors.
- [ ] Diamond tax is fixed at 8%.
- [ ] 10,000 Diamond returns 9,200 after tax.
- [ ] Material Conversion supports 4–6 materials.
- [ ] Rare T1-T8 is supported.
- [ ] Epic T1-T5 is supported.
- [ ] Prime equipment is supported.
- [ ] Enhancement +1 through +15 is supported.
- [ ] Bound equipment is rejected.
- [ ] Unbound Rare+ equipment is accepted.
- [ ] Material point values match the official Netmarble table.
- [ ] Total conversion points update automatically.
- [ ] Six Epic T2 +1~5 equipment correctly display 4,200 total points.
- [ ] Six Rare T5 +1~5 equipment correctly display 600 total points.
- [ ] Conversion Level is NOT guessed.
- [ ] Mobile layout works.
- [ ] Desktop layout works.
- [ ] No database is required.
- [ ] No authentication is required.
- [ ] Official source and unofficial disclaimer are displayed.

---

# 42. Important Instructions for Codex

When implementing this project:

1. Read this README completely before modifying code.
2. Keep conversion point data separate from UI components.
3. Do not invent RF ONLINE NEXT game data.
4. Do not guess Conversion Level thresholds.
5. Do not guess conversion reward probabilities.
6. Only use verified values from the provided conversion tables.
7. Keep Diamond tax in a reusable constant.
8. Keep components modular.
9. Keep TypeScript strict.
10. Avoid `any`.
11. Avoid unnecessary dependencies.
12. Prioritize working calculation logic over visual effects.
13. Do not remove the unofficial disclaimer.
14. If game data is missing, leave a TODO instead of fabricating it.

---

# 43. Future Features

Not required for V1.

Possible future improvements:

```text
Market Profit Calculator
Buy/Sell Diamond Calculator
Reverse Diamond Tax Calculator
Enhancement Cost Calculator
Material Conversion Level Database
Conversion Reward Database
Conversion Probability Calculator
Conversion Expected Value Calculator
Market Price Input
Material Cost vs Expected Reward
Favorite Material Presets
Shareable Calculator URL
Local Storage
PWA Support
```

A particularly useful future feature would be:

```text
Material Conversion Expected Value
```

Example:

```text
Material Cost:
150,000 Diamond

Predicted Rewards:
Reward A: 30%
Reward B: 25%
Reward C: 15%
...

Expected Market Value:
xxx Diamond
```

However, this must only be implemented once verified reward probabilities are available.

---

# Source

Official RF ONLINE NEXT Material Conversion Guide:

https://guide.netmarble.com/rfnext/177

Treat the official guide as the primary source of truth.

The guide notes that its Material Conversion information is based on
test-version content and can change in future game updates.

# Credit By

Please add credit by Rihoko - Anka 3
