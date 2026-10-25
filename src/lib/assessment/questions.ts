import type { LangId } from "./config";

export type ParamType = "int" | "int[]" | "int[][]" | "string";

export interface TestCase {
  args: unknown[];
  expected: unknown;
  hidden?: boolean;
}

export interface Question {
  id: string;
  level: "easy" | "medium";
  title: string;
  statement: string;
  fnName: string;
  params: { name: string; type: ParamType }[];
  returnType: ParamType;
  orderInsensitive?: boolean;
  cases: TestCase[];
}

export const QUESTIONS: Question[] = [
  {
    id: "easy-1",
    level: "easy",
    title: "Two Sum",
    statement:
      "Given an integer array nums and an integer target, return indices of the two numbers such that they add up to target. Exactly one valid solution exists.",
    fnName: "twoSum",
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returnType: "int[]",
    cases: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1], hidden: true },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4], hidden: true },
      { args: [[0, 4, 3, 0], 0], expected: [0, 3], hidden: true },
    ],
  },
  {
    id: "easy-2",
    level: "easy",
    title: "Reverse an Array In-Place",
    statement:
      "Reverse an integer array in-place without allocating extra array space. Return the reversed array.",
    fnName: "reverseArray",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int[]",
    cases: [
      { args: [[1, 2, 3, 4, 5]], expected: [5, 4, 3, 2, 1] },
      { args: [[10, 20]], expected: [20, 10] },
      { args: [[42]], expected: [42], hidden: true },
      { args: [[-3, -2, -1, 0, 1, 2]], expected: [2, 1, 0, -1, -2, -3], hidden: true },
      { args: [[7, 7, 7, 7]], expected: [7, 7, 7, 7], hidden: true },
    ],
  },
  {
    id: "easy-3",
    level: "easy",
    title: "Move Zeroes",
    statement:
      "Given an integer array nums, move all 0's to the end while maintaining the relative order of the non-zero elements. Must be done in-place. Return the array.",
    fnName: "moveZeroes",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int[]",
    cases: [
      { args: [[0, 1, 0, 3, 12]], expected: [1, 3, 12, 0, 0] },
      { args: [[0]], expected: [0] },
      { args: [[1, 2, 3, 4]], expected: [1, 2, 3, 4], hidden: true },
      { args: [[0, 0, 0, 1]], expected: [1, 0, 0, 0], hidden: true },
      { args: [[-1, 0, -3, 0, 5]], expected: [-1, -3, 5, 0, 0], hidden: true },
    ],
  },
  {
    id: "easy-4",
    level: "easy",
    title: "Missing Number",
    statement:
      "Given an array nums containing n distinct numbers in the range [0, n], return the only number in that range missing from the array.",
    fnName: "missingNumber",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
    cases: [
      { args: [[3, 0, 1]], expected: 2 },
      { args: [[0, 1]], expected: 2 },
      { args: [[9, 6, 4, 2, 3, 5, 7, 0, 1]], expected: 8, hidden: true },
      { args: [[0]], expected: 1, hidden: true },
      { args: [[1]], expected: 0, hidden: true },
    ],
  },
  {
    id: "easy-5",
    level: "easy",
    title: "Bubble Sort",
    statement:
      "Sort an array of integers in ascending order using the Bubble Sort algorithm. Return the sorted array.",
    fnName: "bubbleSort",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int[]",
    cases: [
      { args: [[5, 1, 4, 2, 8]], expected: [1, 2, 4, 5, 8] },
      { args: [[3, 2, 1]], expected: [1, 2, 3] },
      { args: [[1, 2, 3, 4, 5]], expected: [1, 2, 3, 4, 5], hidden: true },
      { args: [[10, -1, 3, 8, -5]], expected: [-5, -1, 3, 8, 10], hidden: true },
      { args: [[4, 4, 4, 4]], expected: [4, 4, 4, 4], hidden: true },
    ],
  },
  {
    id: "medium-1",
    level: "medium",
    title: "3Sum",
    statement:
      "Given an integer array nums, return all triplets [nums[i], nums[j], nums[k]] with i != j != k and nums[i] + nums[j] + nums[k] == 0. The solution set must not contain duplicate triplets.",
    fnName: "threeSum",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int[][]",
    orderInsensitive: true,
    cases: [
      { args: [[-1, 0, 1, 2, -1, -4]], expected: [[-1, -1, 2], [-1, 0, 1]] },
      { args: [[0, 1, 1]], expected: [] },
      { args: [[0, 0, 0]], expected: [[0, 0, 0]], hidden: true },
      { args: [[-2, 0, 1, 1, 2]], expected: [[-2, 0, 2], [-2, 1, 1]], hidden: true },
      {
        args: [[-4, -2, -2, -2, 0, 1, 2, 2, 2, 3, 3, 4, 4, 6, 6]],
        expected: [
          [-4, -2, 6],
          [-4, 0, 4],
          [-4, 1, 3],
          [-4, 2, 2],
          [-2, -2, 4],
          [-2, 0, 2],
        ],
        hidden: true,
      },
    ],
  },
  {
    id: "medium-2",
    level: "medium",
    title: "Maximum Subarray (Kadane's Algorithm)",
    statement:
      "Given an integer array nums, find the contiguous subarray (containing at least one number) with the largest sum and return that sum.",
    fnName: "maxSubArray",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
    cases: [
      { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
      { args: [[1]], expected: 1 },
      { args: [[5, 4, -1, 7, 8]], expected: 23, hidden: true },
      { args: [[-5, -2, -8, -1]], expected: -1, hidden: true },
      { args: [[-2, -1]], expected: -1, hidden: true },
    ],
  },
  {
    id: "medium-3",
    level: "medium",
    title: "Best Time to Buy and Sell Stock",
    statement:
      "Given an array prices where prices[i] is the price of a stock on day i, maximize profit by choosing one day to buy and a later day to sell. Return the maximum profit, or 0 if no profit is possible.",
    fnName: "maxProfit",
    params: [{ name: "prices", type: "int[]" }],
    returnType: "int",
    cases: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5 },
      { args: [[7, 6, 4, 3, 1]], expected: 0 },
      { args: [[2, 4, 1]], expected: 2, hidden: true },
      { args: [[3, 2, 6, 5, 0, 3]], expected: 4, hidden: true },
      { args: [[1, 2]], expected: 1, hidden: true },
    ],
  },
  {
    id: "medium-4",
    level: "medium",
    title: "Longest Substring Without Repeating Characters",
    statement:
      "Given a string s, find the length of the longest substring without duplicate characters.",
    fnName: "lengthOfLongestSubstring",
    params: [{ name: "s", type: "string" }],
    returnType: "int",
    cases: [
      { args: ["abcabcbb"], expected: 3 },
      { args: ["bbbbb"], expected: 1 },
      { args: ["pwwkew"], expected: 3, hidden: true },
      { args: [""], expected: 0, hidden: true },
      { args: ["dvdf"], expected: 3, hidden: true },
    ],
  },
  {
    id: "medium-5",
    level: "medium",
    title: "Search in Rotated Sorted Array",
    statement:
      "Given an integer array nums sorted in ascending order (distinct values) rotated at an unknown pivot, and an integer target, return the index of target, or -1 if not present. Runtime must be O(log n).",
    fnName: "search",
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returnType: "int",
    cases: [
      { args: [[4, 5, 6, 7, 0, 1, 2], 0], expected: 4 },
      { args: [[4, 5, 6, 7, 0, 1, 2], 3], expected: -1 },
      { args: [[1], 0], expected: -1, hidden: true },
      { args: [[1, 3], 3], expected: 1, hidden: true },
      { args: [[6, 7, 1, 2, 3, 4, 5], 6], expected: 0, hidden: true },
    ],
  },
];

// ---------- starter templates ----------

function jsTemplate(q: Question): string {
  return `function ${q.fnName}(${q.params.map((p) => p.name).join(", ")}) {
  // Write your solution here
}`;
}

function pyTemplate(q: Question): string {
  return `def ${q.fnName}(${q.params.map((p) => p.name).join(", ")}):
    # Write your solution here
    pass`;
}

function cppType(t: ParamType, ref: boolean): string {
  const base =
    t === "int" ? "int" : t === "int[]" ? "vector<int>" : t === "int[][]" ? "vector<vector<int>>" : "string";
  return ref && t !== "int" ? `${base}&` : base;
}

function cppTemplate(q: Question): string {
  const params = q.params.map((p) => `${cppType(p.type, true)} ${p.name}`).join(", ");
  return `#include <vector>
#include <string>
using namespace std;

${cppType(q.returnType, false)} ${q.fnName}(${params}) {
    // Write your solution here
}`;
}

function cTemplate(q: Question): string {
  const parts: string[] = [];
  for (const p of q.params) {
    if (p.type === "int[]") {
      parts.push(`int* ${p.name}, int ${p.name}Size`);
    } else if (p.type === "int") {
      parts.push(`int ${p.name}`);
    } else {
      parts.push(`const char* ${p.name}`);
    }
  }
  let ret = "int";
  if (q.returnType === "int[]") {
    ret = "int*";
    parts.push("int* returnSize");
  } else if (q.returnType === "int[][]") {
    ret = "int**";
    parts.push("int* returnSize", "int** returnColumnSizes");
  } else if (q.returnType === "string") {
    ret = "char*";
  }
  return `#include <stdlib.h>

${ret} ${q.fnName}(${parts.join(", ")}) {
    /* Write your solution here */
    return 0;
}`;
}

function javaTemplate(q: Question): string {
  const jret = q.returnType === "string" ? "String" : q.returnType;
  const params = q.params
    .map((p) => `${p.type === "string" ? "String" : p.type} ${p.name}`)
    .join(", ");
  return `class Solution {
    public ${jret} ${q.fnName}(${params}) {
        // Write your solution here
    }
}`;
}

export function templateFor(q: Question, lang: LangId): string {
  switch (lang) {
    case "javascript":
      return jsTemplate(q);
    case "python":
      return pyTemplate(q);
    case "cpp":
      return cppTemplate(q);
    case "c":
      return cTemplate(q);
    case "java":
      return javaTemplate(q);
  }
}

export const QUESTION_POOL_SUMMARY = `${QUESTIONS.filter((q) => q.level === "easy").length} easy + ${
  QUESTIONS.filter((q) => q.level === "medium").length
} medium`;
