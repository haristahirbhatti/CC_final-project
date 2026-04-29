/**
 * W++ Language Tokenizer / Lexer
 * Compiler Construction CS-310 - Spring 2K26
 *
 * Produces all required statistical reports as per assignment spec.
 */

// ── W++ Language Spec ─────────────────────────────────────────────────────────

const KEYWORDS = new Set([
  "int", "float", "double", "char", "string",
  "if", "else", "while", "for", "return",
  "print", "read", "true", "false"
]);

const OPERATORS_2 = {
  "<=": "OPERATOR_LTE",
  ">=": "OPERATOR_GTE",
  "==": "OPERATOR_EQ",
  "!=": "OPERATOR_NEQ",
  "&&": "OPERATOR_AND",
  "||": "OPERATOR_OR"
};

const OPERATORS_1 = {
  "=":  "OPERATOR_ASSIGN",
  "+":  "OPERATOR_PLUS",
  "-":  "OPERATOR_MINUS",
  "*":  "OPERATOR_MULT",
  "/":  "OPERATOR_DIV",
  "%":  "OPERATOR_MOD",
  "<":  "OPERATOR_LT",
  ">":  "OPERATOR_GT",
  "!":  "OPERATOR_NOT"
};

const SEPARATORS = {
  ";": "SEPARATOR_SEMICOLON",
  ",": "SEPARATOR_COMMA",
  "(": "SEPARATOR_LPAREN",
  ")": "SEPARATOR_RPAREN",
  "{": "SEPARATOR_LBRACE",
  "}": "SEPARATOR_RBRACE",
  "[": "SEPARATOR_LBRACKET",
  "]": "SEPARATOR_RBRACKET"
};

// ── Tokenizer ─────────────────────────────────────────────────────────────────

/**
 * Tokenize W++ source code.
 * @param {string} source - Raw W++ source text
 * @returns {object} Full analysis result
 */
function tokenize(source) {
  const rawLines = source.split("\n");
  const tokens = [];

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const line = rawLines[lineIdx];
    const lineNum = lineIdx + 1;
    let i = 0;

    while (i < line.length) {
      // Skip whitespace
      if (/[ \t\r]/.test(line[i])) { i++; continue; }

      // Single-line comment  //
      if (line[i] === "/" && line[i + 1] === "/") {
        tokens.push({
          category: "COMMENT",
          type: "COMMENT",
          value: line.slice(i),
          line: lineNum
        });
        break; // rest of line is comment
      }

      // Multi-line comment  /* ... */  (single-line occurrence)
      if (line[i] === "/" && line[i + 1] === "*") {
        const end = line.indexOf("*/", i + 2);
        const val = end === -1 ? line.slice(i) : line.slice(i, end + 2);
        tokens.push({ category: "COMMENT", type: "COMMENT", value: val, line: lineNum });
        i = end === -1 ? line.length : end + 2;
        continue;
      }

      // String literal  "..."
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length) {
          if (line[j] === '\\') { j += 2; continue; }
          if (line[j] === '"') break;
          j++;
        }
        tokens.push({ category: "LITERAL", type: "LITERAL_STRING", value: line.slice(i, j + 1), line: lineNum });
        i = j + 1;
        continue;
      }

      // Char literal  '...'
      if (line[i] === "'") {
        let j = i + 1;
        while (j < line.length) {
          if (line[j] === '\\') { j += 2; continue; }
          if (line[j] === "'") break;
          j++;
        }
        tokens.push({ category: "LITERAL", type: "LITERAL_CHAR", value: line.slice(i, j + 1), line: lineNum });
        i = j + 1;
        continue;
      }

      // Numeric literal (integer or float)
      if (/[0-9]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[0-9]/.test(line[j])) j++;
        let type = "LITERAL_INTEGER";
        if (line[j] === "." && /[0-9]/.test(line[j + 1] || "")) {
          j++;
          while (j < line.length && /[0-9]/.test(line[j])) j++;
          type = "LITERAL_FLOAT";
        }
        tokens.push({ category: "LITERAL", type, value: line.slice(i, j), line: lineNum });
        i = j;
        continue;
      }

      // Identifier or keyword
      if (/[a-zA-Z_]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
        const val = line.slice(i, j);
        if (KEYWORDS.has(val)) {
          tokens.push({ category: "KEYWORD", type: "KEYWORD_" + val.toUpperCase(), value: val, line: lineNum });
        } else {
          tokens.push({ category: "IDENTIFIER", type: "IDENTIFIER", value: val, line: lineNum });
        }
        i = j;
        continue;
      }

      // Two-character operators
      const two = line.slice(i, i + 2);
      if (OPERATORS_2[two]) {
        tokens.push({ category: "OPERATOR", type: OPERATORS_2[two], value: two, line: lineNum });
        i += 2;
        continue;
      }

      // One-character operators
      if (OPERATORS_1[line[i]]) {
        tokens.push({ category: "OPERATOR", type: OPERATORS_1[line[i]], value: line[i], line: lineNum });
        i++;
        continue;
      }

      // Separators / punctuation
      if (SEPARATORS[line[i]]) {
        tokens.push({ category: "SEPARATOR", type: SEPARATORS[line[i]], value: line[i], line: lineNum });
        i++;
        continue;
      }

      // Unknown character
      tokens.push({ category: "UNKNOWN", type: "UNKNOWN", value: line[i], line: lineNum });
      i++;
    }
  }

  return buildReport(tokens, rawLines);
}

// ── Report Builder ────────────────────────────────────────────────────────────

function buildReport(tokens, rawLines) {
  const totalLines = rawLines.length;
  const linesWithCode = rawLines.filter(l => {
    const trimmed = l.trim();
    return trimmed.length > 0 && !trimmed.startsWith("//");
  }).length;

  const totalTokens = tokens.length;

  // ── 1. Token Type Summary ──
  const typeSummaryMap = {};
  tokens.forEach(t => {
    if (!typeSummaryMap[t.type]) {
      typeSummaryMap[t.type] = {
        category: t.category,
        tokenType: t.type,
        quantity: 0,
        lines: new Set()
      };
    }
    typeSummaryMap[t.type].quantity++;
    typeSummaryMap[t.type].lines.add(t.line);
  });

  const tokenTypeSummary = Object.values(typeSummaryMap).map(r => ({
    category: r.category,
    tokenType: r.tokenType,
    quantity: r.quantity,
    percentage: totalTokens > 0 ? ((r.quantity / totalTokens) * 100).toFixed(2) + "%" : "0.00%",
    lines: [...r.lines].sort((a, b) => a - b).join(",")
  })).sort((a, b) => b.quantity - a.quantity);

  // ── 2. Line-wise Token Distribution ──
  const lineTokenCountMap = {};
  tokens.filter(t => t.category !== "COMMENT" && t.category !== "WHITESPACE").forEach(t => {
    lineTokenCountMap[t.line] = (lineTokenCountMap[t.line] || 0) + 1;
  });

  const lineDistribution = Object.entries(lineTokenCountMap)
    .map(([line, count]) => ({ lineNumber: parseInt(line), tokenCount: count }))
    .sort((a, b) => a.lineNumber - b.lineNumber);

  // ── 3. Identifier Statistics ──
  const identMap = {};
  tokens.filter(t => t.category === "IDENTIFIER").forEach(t => {
    if (!identMap[t.value]) identMap[t.value] = { frequency: 0, lines: new Set() };
    identMap[t.value].frequency++;
    identMap[t.value].lines.add(t.line);
  });

  const identifierStats = Object.entries(identMap)
    .map(([name, data]) => ({
      identifier: name,
      frequency: data.frequency,
      lines: [...data.lines].sort((a, b) => a - b).join(",")
    }))
    .sort((a, b) => b.frequency - a.frequency);

  // ── 4. Literal Statistics ──
  const litMap = {};
  tokens.filter(t => t.category === "LITERAL").forEach(t => {
    if (!litMap[t.value]) litMap[t.value] = { type: t.type, frequency: 0, lines: new Set() };
    litMap[t.value].frequency++;
    litMap[t.value].lines.add(t.line);
  });

  const literalStats = Object.entries(litMap)
    .map(([val, data]) => ({
      literal: val,
      type: data.type.replace("LITERAL_", ""),
      frequency: data.frequency,
      lines: [...data.lines].sort((a, b) => a - b).join(",")
    }))
    .sort((a, b) => b.frequency - a.frequency);

  // ── 5. Overall Summary ──
  const codeOnlyTokens = tokens.filter(t => t.category !== "COMMENT");
  const sortedByFreq = [...tokenTypeSummary].sort((a, b) => b.quantity - a.quantity);
  const mostFrequent = sortedByFreq[0] || null;
  const leastFrequent = sortedByFreq[sortedByFreq.length - 1] || null;

  const tokensPerLine = lineDistribution.map(l => l.tokenCount);
  const avgTokensPerLine = linesWithCode > 0
    ? (codeOnlyTokens.length / linesWithCode).toFixed(2)
    : "0.00";

  const maxTokensInLine = tokensPerLine.length > 0 ? Math.max(...tokensPerLine) : 0;
  const minTokensInLine = tokensPerLine.length > 0 ? Math.min(...tokensPerLine) : 0;
  const maxTokenLine = lineDistribution.find(l => l.tokenCount === maxTokensInLine);
  const minTokenLine = lineDistribution.find(l => l.tokenCount === minTokensInLine);

  // ── 6. Token Category Breakdown ──
  const catBreakdown = {};
  tokens.forEach(t => {
    catBreakdown[t.category] = (catBreakdown[t.category] || 0) + 1;
  });

  const categoryBreakdown = Object.entries(catBreakdown)
    .map(([category, total]) => ({
      category,
      total,
      percentage: totalTokens > 0 ? ((total / totalTokens) * 100).toFixed(2) + "%" : "0.00%"
    }))
    .sort((a, b) => b.total - a.total);

  return {
    meta: {
      totalLines,
      linesWithCode,
      emptyLines: totalLines - linesWithCode,
      totalTokens
    },
    tokenTypeSummary,
    lineDistribution,
    identifierStats,
    literalStats,
    overallSummary: {
      totalTokens,
      uniqueTokenTypes: tokenTypeSummary.length,
      linesWithCode,
      emptyIgnoredLines: totalLines - linesWithCode,
      mostFrequentToken: mostFrequent
        ? `${mostFrequent.tokenType} (${mostFrequent.quantity} occurrences, ${mostFrequent.percentage})`
        : "N/A",
      leastFrequentToken: leastFrequent
        ? `${leastFrequent.tokenType} (${leastFrequent.quantity} occurrence, ${leastFrequent.percentage})`
        : "N/A",
      averageTokensPerLine: avgTokensPerLine,
      maximumTokensInLine: maxTokenLine
        ? `${maxTokensInLine} (Line ${maxTokenLine.lineNumber})`
        : "N/A",
      minimumTokensInLine: minTokenLine
        ? `${minTokensInLine} (Line ${minTokenLine.lineNumber})`
        : "N/A"
    },
    categoryBreakdown,
    // Raw tokens for frontend token table
    rawTokens: tokens.filter(t => t.category !== "COMMENT").map(t => ({
      line: t.line,
      category: t.category,
      type: t.type,
      value: t.value
    }))
  };
}

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = { tokenize };
