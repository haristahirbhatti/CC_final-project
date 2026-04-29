import React, { useState, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE TOKENIZER (mirrors backend logic, used for instant analysis)
// ─────────────────────────────────────────────────────────────────────────────
const KEYWORDS = new Set([
  "int","float","double","char","string","if","else","while",
  "for","return","print","read","true","false"
]);
const OPS2 = {"<=":"OPERATOR_LTE",">=":"OPERATOR_GTE","==":"OPERATOR_EQ",
               "!=":"OPERATOR_NEQ","&&":"OPERATOR_AND","||":"OPERATOR_OR"};
const OPS1 = {"=":"OPERATOR_ASSIGN","+":"OPERATOR_PLUS","-":"OPERATOR_MINUS",
               "*":"OPERATOR_MULT","/":"OPERATOR_DIV","%":"OPERATOR_MOD",
               "<":"OPERATOR_LT",">":"OPERATOR_GT","!":"OPERATOR_NOT"};
const SEPS = {";":"SEPARATOR_SEMICOLON",",":"SEPARATOR_COMMA",
              "(":"SEPARATOR_LPAREN",")":"SEPARATOR_RPAREN",
              "{":"SEPARATOR_LBRACE","}":"SEPARATOR_RBRACE",
              "[":"SEPARATOR_LBRACKET","]":"SEPARATOR_RBRACKET"};

function clientTokenize(source) {
  const rawLines = source.split("\n");
  const tokens = [];

  rawLines.forEach((line, li) => {
    const lineNum = li + 1;
    let i = 0;
    while (i < line.length) {
      if (/[ \t\r]/.test(line[i])) { i++; continue; }
      if (line[i]==="/" && line[i+1]==="/") {
        tokens.push({category:"COMMENT",type:"COMMENT",value:line.slice(i),line:lineNum});
        break;
      }
      if (line[i]==="/" && line[i+1]==="*") {
        const end = line.indexOf("*/",i+2);
        tokens.push({category:"COMMENT",type:"COMMENT",value:end===-1?line.slice(i):line.slice(i,end+2),line:lineNum});
        i = end===-1?line.length:end+2; continue;
      }
      if (line[i]==='"') {
        let j=i+1;
        while(j<line.length){if(line[j]==="\\"){j+=2;continue;}if(line[j]==='"')break;j++;}
        tokens.push({category:"LITERAL",type:"LITERAL_STRING",value:line.slice(i,j+1),line:lineNum});
        i=j+1; continue;
      }
      if (line[i]==="'") {
        let j=i+1;
        while(j<line.length){if(line[j]==="\\"){j+=2;continue;}if(line[j]==="'")break;j++;}
        tokens.push({category:"LITERAL",type:"LITERAL_CHAR",value:line.slice(i,j+1),line:lineNum});
        i=j+1; continue;
      }
      if (/[0-9]/.test(line[i])) {
        let j=i;
        while(j<line.length&&/[0-9]/.test(line[j]))j++;
        let type="LITERAL_INTEGER";
        if(line[j]==="."&&/[0-9]/.test(line[j+1]||"")){j++;while(j<line.length&&/[0-9]/.test(line[j]))j++;type="LITERAL_FLOAT";}
        tokens.push({category:"LITERAL",type,value:line.slice(i,j),line:lineNum});
        i=j; continue;
      }
      if (/[a-zA-Z_]/.test(line[i])) {
        let j=i;
        while(j<line.length&&/[a-zA-Z0-9_]/.test(line[j]))j++;
        const val=line.slice(i,j);
        tokens.push(KEYWORDS.has(val)
          ?{category:"KEYWORD",type:"KEYWORD_"+val.toUpperCase(),value:val,line:lineNum}
          :{category:"IDENTIFIER",type:"IDENTIFIER",value:val,line:lineNum});
        i=j; continue;
      }
      const two=line.slice(i,i+2);
      if(OPS2[two]){tokens.push({category:"OPERATOR",type:OPS2[two],value:two,line:lineNum});i+=2;continue;}
      if(OPS1[line[i]]){tokens.push({category:"OPERATOR",type:OPS1[line[i]],value:line[i],line:lineNum});i++;continue;}
      if(SEPS[line[i]]){tokens.push({category:"SEPARATOR",type:SEPS[line[i]],value:line[i],line:lineNum});i++;continue;}
      tokens.push({category:"UNKNOWN",type:"UNKNOWN",value:line[i],line:lineNum});
      i++;
    }
  });

  return buildReport(tokens, rawLines);
}

function buildReport(tokens, rawLines) {
  const totalLines = rawLines.length;
  const linesWithCode = rawLines.filter(l=>{const t=l.trim();return t.length>0&&!t.startsWith("//");}).length;
  const totalTokens = tokens.length;

  // 1. Token Type Summary
  const tsMap = {};
  tokens.forEach(t=>{
    if(!tsMap[t.type]) tsMap[t.type]={category:t.category,tokenType:t.type,quantity:0,lines:new Set()};
    tsMap[t.type].quantity++;
    tsMap[t.type].lines.add(t.line);
  });
  const tokenTypeSummary = Object.values(tsMap).map(r=>({
    category:r.category,
    tokenType:r.tokenType,
    quantity:r.quantity,
    percentage:totalTokens>0?((r.quantity/totalTokens)*100).toFixed(2)+"%":"0.00%",
    lines:[...r.lines].sort((a,b)=>a-b).join(",")
  })).sort((a,b)=>b.quantity-a.quantity);

  // 2. Line Distribution
  const lineMap = {};
  tokens.filter(t=>t.category!=="COMMENT").forEach(t=>{lineMap[t.line]=(lineMap[t.line]||0)+1;});
  const lineDistribution = Object.entries(lineMap)
    .map(([line,count])=>({lineNumber:parseInt(line),tokenCount:count}))
    .sort((a,b)=>a.lineNumber-b.lineNumber);

  // 3. Identifier Stats
  const idMap = {};
  tokens.filter(t=>t.category==="IDENTIFIER").forEach(t=>{
    if(!idMap[t.value]) idMap[t.value]={frequency:0,lines:new Set()};
    idMap[t.value].frequency++;
    idMap[t.value].lines.add(t.line);
  });
  const identifierStats = Object.entries(idMap)
    .map(([name,d])=>({identifier:name,frequency:d.frequency,lines:[...d.lines].sort((a,b)=>a-b).join(",")}))
    .sort((a,b)=>b.frequency-a.frequency);

  // 4. Literal Stats
  const litMap = {};
  tokens.filter(t=>t.category==="LITERAL").forEach(t=>{
    if(!litMap[t.value]) litMap[t.value]={type:t.type,frequency:0,lines:new Set()};
    litMap[t.value].frequency++;
    litMap[t.value].lines.add(t.line);
  });
  const literalStats = Object.entries(litMap)
    .map(([val,d])=>({literal:val,type:d.type.replace("LITERAL_",""),frequency:d.frequency,lines:[...d.lines].sort((a,b)=>a-b).join(",")}))
    .sort((a,b)=>b.frequency-a.frequency);

  // 5. Overall Summary
  const codeTokens = tokens.filter(t=>t.category!=="COMMENT");
  const sorted = [...tokenTypeSummary].sort((a,b)=>b.quantity-a.quantity);
  const most = sorted[0], least = sorted[sorted.length-1];
  const tpl = lineDistribution.map(l=>l.tokenCount);
  const avgTPL = linesWithCode>0?(codeTokens.length/linesWithCode).toFixed(2):"0.00";
  const maxTPL = tpl.length?Math.max(...tpl):0;
  const minTPL = tpl.length?Math.min(...tpl):0;
  const maxLine = lineDistribution.find(l=>l.tokenCount===maxTPL);
  const minLine = lineDistribution.find(l=>l.tokenCount===minTPL);

  // 6. Category Breakdown
  const catMap = {};
  tokens.forEach(t=>{catMap[t.category]=(catMap[t.category]||0)+1;});
  const categoryBreakdown = Object.entries(catMap)
    .map(([cat,total])=>({category:cat,total,percentage:totalTokens>0?((total/totalTokens)*100).toFixed(2)+"%":"0.00%"}))
    .sort((a,b)=>b.total-a.total);

  return {
    meta:{totalLines,linesWithCode,emptyLines:totalLines-linesWithCode,totalTokens},
    tokenTypeSummary,
    lineDistribution,
    identifierStats,
    literalStats,
    overallSummary:{
      totalTokens,
      uniqueTokenTypes:tokenTypeSummary.length,
      linesWithCode,
      emptyIgnoredLines:totalLines-linesWithCode,
      mostFrequentToken: most?`${most.tokenType} (${most.quantity} occurrences, ${most.percentage})`:"N/A",
      leastFrequentToken: least?`${least.tokenType} (${least.quantity} occurrence, ${least.percentage})`:"N/A",
      averageTokensPerLine:avgTPL,
      maximumTokensInLine: maxLine?`${maxTPL} (Line ${maxLine.lineNumber})`:"N/A",
      minimumTokensInLine: minLine?`${minTPL} (Line ${minLine.lineNumber})`:"N/A"
    },
    categoryBreakdown,
    rawTokens: tokens.filter(t=>t.category!=="COMMENT").map(t=>({line:t.line,category:t.category,type:t.type,value:t.value}))
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — white theme matching screenshot
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:        "#f0f2f5",
  panel:     "#ffffff",
  border:    "#dde2ea",
  borderInner:"#e8ecf2",
  teal:      "#2bbb99",
  tealDark:  "#23a085",
  tealLight: "#f0fdf9",
  text:      "#1a2a3a",
  textMid:   "#3a4a5c",
  textSub:   "#6a7a8a",
  textFaint: "#8a9ab0",
  textGhost: "#a8b4c0",
  rowAlt:    "#fafbfc",
  tableHead: "#f8fafc",
};

const BADGE_STYLES = {
  KEYWORD:    {bg:"#e8f4fd",color:"#1565c0",border:"#bbdefb"},
  IDENTIFIER: {bg:"#e8f5e9",color:"#2e7d32",border:"#c8e6c9"},
  OPERATOR:   {bg:"#fce4ec",color:"#ad1457",border:"#f8bbd0"},
  LITERAL:    {bg:"#fff8e1",color:"#f57f17",border:"#ffecb3"},
  SEPARATOR:  {bg:"#ede7f6",color:"#4527a0",border:"#d1c4e9"},
  COMMENT:    {bg:"#f5f5f5",color:"#616161",border:"#e0e0e0"},
  UNKNOWN:    {bg:"#fbe9e7",color:"#bf360c",border:"#ffccbc"},
};

function Badge({cat}){
  const s = BADGE_STYLES[cat]||BADGE_STYLES.UNKNOWN;
  return (
    <span style={{
      background:s.bg,color:s.color,border:`1px solid ${s.border}`,
      borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:600,
      fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",display:"inline-block"
    }}>{cat}</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Card({title, children, extra}){
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 20px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontSize:11,fontWeight:700,color:C.textMid,letterSpacing:0.8,fontFamily:"'JetBrains Mono',monospace"}}>{title}</span>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Th({children,style={}}){
  return <th style={{padding:"8px 12px",color:C.textFaint,textAlign:"left",fontSize:11,fontWeight:600,
    borderBottom:`1.5px solid ${C.border}`,background:C.tableHead,fontFamily:"'JetBrains Mono',monospace",...style}}>{children}</th>;
}
function Td({children,style={}}){
  return <td style={{padding:"7px 12px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:C.textMid,...style}}>{children}</td>;
}

// ── 1. Token Type Summary (matches PDF Section 1) ──
function TokenTypeSummary({data}){
  return (
    <Card title="1. TOKEN TYPE SUMMARY">
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <Th>Category</Th>
              <Th>Token Type</Th>
              <Th style={{textAlign:"center"}}>Qty</Th>
              <Th style={{textAlign:"center"}}>%</Th>
              <Th>Lines</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((row,i)=>(
              <tr key={row.tokenType} style={{borderBottom:`1px solid ${C.borderInner}`,background:i%2===0?C.panel:C.rowAlt}}>
                <Td><Badge cat={row.category}/></Td>
                <Td style={{color:C.text,fontWeight:500}}>{row.tokenType}</Td>
                <Td style={{textAlign:"center",color:C.teal,fontWeight:700}}>{row.quantity}</Td>
                <Td style={{textAlign:"center",color:C.textSub}}>{row.percentage}</Td>
                <Td style={{color:C.textFaint,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.lines}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── 2. Line Distribution (matches PDF Section 2) ──
function LineDistribution({data}){
  const max = data.length?Math.max(...data.map(d=>d.tokenCount)):1;
  return (
    <Card title="2. LINE-WISE TOKEN DISTRIBUTION">
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr>
            <Th>Line Number</Th>
            <Th>Total Tokens</Th>
            <Th>Distribution</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((row,i)=>(
            <tr key={row.lineNumber} style={{borderBottom:`1px solid ${C.borderInner}`,background:i%2===0?C.panel:C.rowAlt}}>
              <Td style={{color:C.textSub}}>Line {row.lineNumber}</Td>
              <Td style={{color:C.teal,fontWeight:700}}>{row.tokenCount}</Td>
              <Td>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:180,height:14,background:C.bg,borderRadius:3}}>
                    <div style={{height:"100%",width:`${(row.tokenCount/max)*100}%`,background:C.teal,borderRadius:3,minWidth:row.tokenCount>0?3:0}}/>
                  </div>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ── 3. Identifier Statistics (matches PDF Section 3) ──
function IdentifierStats({data}){
  return (
    <Card title="3. IDENTIFIER STATISTICS">
      {data.length===0
        ? <p style={{color:C.textGhost,fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>No identifiers found.</p>
        : <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <Th>Identifier</Th>
                <Th style={{textAlign:"center"}}>Frequency</Th>
                <Th>Lines</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((row,i)=>(
                <tr key={row.identifier} style={{borderBottom:`1px solid ${C.borderInner}`,background:i%2===0?C.panel:C.rowAlt}}>
                  <Td style={{color:"#1565c0",fontWeight:600}}>{row.identifier}</Td>
                  <Td style={{textAlign:"center",color:C.teal,fontWeight:700}}>{row.frequency}</Td>
                  <Td style={{color:C.textFaint}}>{row.lines}</Td>
                </tr>
              ))}
            </tbody>
          </table>
      }
    </Card>
  );
}

// ── 4. Literal Statistics (matches PDF Section 4) ──
function LiteralStats({data}){
  const typeColor={"INTEGER":"#f57f17","FLOAT":"#d84315","STRING":"#6a1b9a","CHAR":"#1b5e20"};
  return (
    <Card title="4. LITERAL STATISTICS">
      {data.length===0
        ? <p style={{color:C.textGhost,fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>No literals found.</p>
        : <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <Th>Literal</Th>
                <Th>Type</Th>
                <Th style={{textAlign:"center"}}>Frequency</Th>
                <Th>Lines</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((row,i)=>(
                <tr key={row.literal+i} style={{borderBottom:`1px solid ${C.borderInner}`,background:i%2===0?C.panel:C.rowAlt}}>
                  <Td style={{color:C.text,fontWeight:600}}>{row.literal}</Td>
                  <Td style={{color:typeColor[row.type]||C.textSub,fontWeight:600}}>{row.type}</Td>
                  <Td style={{textAlign:"center",color:C.teal,fontWeight:700}}>{row.frequency}</Td>
                  <Td style={{color:C.textFaint}}>{row.lines}</Td>
                </tr>
              ))}
            </tbody>
          </table>
      }
    </Card>
  );
}

// ── 5. Overall Summary (matches PDF Section 5) ──
function OverallSummary({data}){
  const rows = [
    ["Total Tokens",             data.totalTokens],
    ["Unique Token Types",       data.uniqueTokenTypes],
    ["Total Lines with Code",    data.linesWithCode],
    ["Empty / Ignored Lines",    data.emptyIgnoredLines],
    ["Most Frequent Token",      data.mostFrequentToken],
    ["Least Frequent Token",     data.leastFrequentToken],
    ["Average Tokens per Line",  data.averageTokensPerLine],
    ["Maximum Tokens in a Line", data.maximumTokensInLine],
    ["Minimum Tokens in a Line", data.minimumTokensInLine],
  ];
  return (
    <Card title="5. TOKEN SUMMARY STATISTICS">
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <tbody>
          {rows.map(([k,v],i)=>(
            <tr key={k} style={{borderBottom:`1px solid ${C.borderInner}`,background:i%2===0?C.panel:C.rowAlt}}>
              <td style={{padding:"8px 12px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:C.textSub,width:"45%"}}>{k}</td>
              <td style={{padding:"8px 12px",fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:C.teal,fontWeight:700}}>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ── 6. Category Breakdown (matches PDF Section 6) ──
function CategoryBreakdown({data,totalTokens}){
  const maxV = data.length?Math.max(...data.map(d=>d.total)):1;
  return (
    <Card title="6. TOKEN CATEGORY BREAKDOWN">
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20}}>
        <thead>
          <tr>
            <Th>Category</Th>
            <Th style={{textAlign:"center"}}>Total</Th>
            <Th style={{textAlign:"center"}}>Percentage</Th>
          </tr>
        </thead>
        <tbody>
          {data.map((row,i)=>(
            <tr key={row.category} style={{borderBottom:`1px solid ${C.borderInner}`,background:i%2===0?C.panel:C.rowAlt}}>
              <Td><Badge cat={row.category}/></Td>
              <Td style={{textAlign:"center",color:C.teal,fontWeight:700}}>{row.total}</Td>
              <Td style={{textAlign:"center",color:C.textSub}}>{row.percentage}</Td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Bar chart — mirrors the screenshot */}
      <div style={{borderTop:`1px solid ${C.borderInner}`,paddingTop:16}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textMid,letterSpacing:0.8,
          fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>TOKEN BREAKDOWN BY TYPE</div>
        {data.map(d=>{
          const pct = totalTokens>0?Math.round((d.total/totalTokens)*100):0;
          return (
            <div key={d.category} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
              <div style={{width:114,fontSize:11,color:C.textSub,textAlign:"right",
                fontFamily:"'JetBrains Mono',monospace"}}>{d.category}</div>
              <div style={{flex:1,height:22,background:C.bg,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:C.teal,
                  borderRadius:4,transition:"width 0.7s ease",minWidth:pct>0?4:0}}/>
              </div>
              <div style={{width:42,fontSize:12,color:C.textMid,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{pct}%</div>
            </div>
          );
        })}
        <div style={{display:"flex",paddingLeft:126}}>
          {["0%","20%","40%","60%","80%","100%"].map(l=>(
            <div key={l} style={{flex:1,fontSize:10,color:C.textGhost,fontFamily:"'JetBrains Mono',monospace"}}>{l}</div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Token Detail Table (matches screenshot right panel) ──
function TokenDetailTable({tokens}){
  return (
    <Card title="TOKEN SUMMARY TABLE">
      <div style={{overflowX:"auto",maxHeight:500,overflowY:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{position:"sticky",top:0,zIndex:1}}>
            <tr>
              <Th>LINE #</Th>
              <Th>CATEGORY</Th>
              <Th>TYPE</Th>
              <Th>TOKEN VALUE</Th>
              <Th style={{textAlign:"center"}}>QTY</Th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t,i)=>{
              const dispType = t.type
                .replace(/^KEYWORD_/,"")
                .replace(/^OPERATOR_/,"")
                .replace(/^SEPARATOR_/,"")
                .replace(/^LITERAL_/,"");
              return (
                <tr key={i} style={{borderBottom:`1px solid ${C.borderInner}`,background:i%2===0?C.panel:C.rowAlt}}>
                  <Td style={{color:C.textFaint}}>L{t.line}</Td>
                  <Td><Badge cat={t.category}/></Td>
                  <Td style={{color:C.textSub}}>{dispType}</Td>
                  <Td style={{color:C.text,fontWeight:600}}>{t.value}</Td>
                  <Td style={{textAlign:"center",color:C.teal,fontWeight:700}}>1</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE CODE (from PDF test program)
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE = `// W++ Token Analyzer Test Program
// This program demonstrates all token types
int main() {
    int age = 25;
    float temperature = 36.6;
    double pi = 3.14159;
    char grade = 'A';
    string name = "John Doe";

    int x = 10, y = 20, z = 30;

    int sum = x + y + z;

    if (age >= 18 && age <= 60) {
        print "Adult age range";
        string status = "Working";
    } else {
        print "Minor";
        string status = "Student";
    }

    int counter = 0;
    while (counter < 10) {
        counter = counter + 1;
    }

    return 0;
}`;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  {id:"overview",  label:"Overview"},
  {id:"token_type",label:"1. Token Type Summary"},
  {id:"line_dist", label:"2. Line Distribution"},
  {id:"identifiers",label:"3. Identifiers"},
  {id:"literals",  label:"4. Literals"},
  {id:"summary",   label:"5. Overall Summary"},
  {id:"category",  label:"6. Category Breakdown"},
  {id:"table",     label:"Token Table"},
];

export default function App() {
  const [code,     setCode]     = useState(SAMPLE);
  const [result,   setResult]   = useState(null);
  const [activeTab,setActiveTab]= useState("overview");
  const [fileName, setFileName] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const fileRef = useRef();

  const runAnalysis = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true); setError(null);
    try {
      // Try backend first, fall back to client-side
      try {
        const resp = await fetch("/api/analyze", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({source: code, filename: fileName||"untitled.wpp"})
        });
        if (resp.ok) {
          const json = await resp.json();
          setResult({...json.data, filename: json.data.filename||fileName||"untitled.wpp"});
          setActiveTab("overview");
          setLoading(false);
          return;
        }
      } catch(_) { /* backend not available, use client tokenizer */ }
      // Client-side fallback
      const r = clientTokenize(code);
      r.filename = fileName||"untitled.wpp";
      setResult(r);
      setActiveTab("overview");
    } catch(e) {
      setError("Analysis failed: " + e.message);
    }
    setLoading(false);
  }, [code, fileName]);

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => setCode(e.target.result);
    reader.readAsText(file);
  };

  const codeLines = code.split("\n");

  // ── RENDER ──
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',sans-serif"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:#f0f0f0;}
        ::-webkit-scrollbar-thumb{background:#c8d0da;border-radius:3px;}
        textarea{outline:none;resize:none;}
        button{cursor:pointer;font-family:inherit;}
        .tab-btn:hover{color:${C.teal} !important;}
        .upload-btn:hover{border-color:${C.teal} !important;color:${C.teal} !important;}
        .run-btn:hover{background:${C.tealDark} !important;}
        .dropzone:hover{border-color:${C.teal} !important;background:#f0fdf9 !important;}
      `}</style>

      {/* ── TOP HEADER ── */}
      <div style={{
        background:C.panel,borderBottom:`1px solid ${C.border}`,
        height:58,display:"flex",alignItems:"center",justifyContent:"center",gap:12
      }}>
        {/* Shield icon */}
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <path d="M15 3L5 8v9c0 5.8 4.4 11.2 10 12.6C20.6 28.2 25 22.8 25 17V8L15 3z"
            fill={C.teal} fillOpacity="0.13"/>
          <path d="M15 3L5 8v9c0 5.8 4.4 11.2 10 12.6C20.6 28.2 25 22.8 25 17V8L15 3z"
            stroke={C.teal} strokeWidth="1.8" fill="none"/>
          <text x="15" y="19" textAnchor="middle" fill={C.teal}
            fontSize="8" fontWeight="bold" fontFamily="monospace">W+</text>
        </svg>
        <span style={{fontSize:21,fontWeight:700,color:C.text,letterSpacing:1.5,
          fontFamily:"'JetBrains Mono',monospace"}}>W++ TOKEN ANALYZER</span>
        <span style={{fontSize:13,color:C.teal,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>V1.0</span>
      </div>

      {/* ── BODY ── */}
      <div style={{display:"flex",height:"calc(100vh - 58px)",overflow:"hidden"}}>

        {/* ══ LEFT — EDITOR ══ */}
        <div style={{width:460,minWidth:340,display:"flex",flexDirection:"column",
          background:C.panel,borderRight:`1px solid ${C.border}`}}>

          {/* Panel title */}
          <div style={{padding:"11px 16px",borderBottom:`1px solid ${C.borderInner}`,
            background:C.rowAlt,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:C.teal,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13}}>&lt;/&gt;</span>
              <span style={{fontSize:11,fontWeight:700,color:C.textMid,letterSpacing:0.8}}>1. SOURCE CODE EDITOR (.WPP)</span>
            </div>
            <span style={{color:C.textGhost,fontSize:17}}>⚙</span>
          </div>

          {/* Drop zone */}
          <div className="dropzone"
            onDragOver={e=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef.current.click()}
            style={{
              margin:"10px 14px 0",
              border:`2px dashed ${dragging?C.teal:"#c8d4e0"}`,
              borderRadius:8,padding:"9px 14px",
              background:dragging?"#f0fdf9":C.rowAlt,
              cursor:"pointer",textAlign:"center",transition:"all 0.2s"
            }}>
            <input ref={fileRef} type="file" accept=".wpp,.txt,.cpp,.c"
              style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            <span style={{fontSize:12,color:fileName?C.teal:C.textFaint,
              fontFamily:"'JetBrains Mono',monospace"}}>
              {fileName?`✓  ${fileName}`:"📂  Drop .wpp file here or click to browse"}
            </span>
            <div style={{fontSize:10,color:C.textGhost,marginTop:2}}>Supports .wpp · .txt · .c · .cpp</div>
          </div>

          {/* Line-numbered editor */}
          <div style={{flex:1,margin:"10px 14px 0",border:`1px solid ${C.border}`,
            borderRadius:8,display:"flex",overflow:"hidden",background:C.panel}}>
            {/* Gutter */}
            <div style={{width:40,background:C.rowAlt,borderRight:`1px solid ${C.borderInner}`,
              paddingTop:12,flexShrink:0,overflowY:"hidden"}}>
              {codeLines.map((_,i)=>(
                <div key={i} style={{height:21,lineHeight:"21px",textAlign:"right",
                  paddingRight:8,fontSize:12,color:"#b0bcc8",
                  fontFamily:"'JetBrains Mono',monospace"}}>{i+1}</div>
              ))}
            </div>
            {/* Textarea */}
            <textarea value={code} onChange={e=>setCode(e.target.value)} spellCheck={false}
              style={{flex:1,border:"none",padding:"12px 12px",
                fontFamily:"'JetBrains Mono',monospace",fontSize:13,
                color:C.text,lineHeight:"21px",background:C.panel,overflowY:"auto"}}/>
          </div>

          {/* Buttons */}
          <div style={{padding:"10px 14px 14px",display:"flex",gap:10}}>
            <button className="upload-btn" onClick={()=>fileRef.current.click()}
              style={{flex:1,padding:"10px 0",background:C.panel,
                border:`1.5px solid ${C.border}`,borderRadius:7,
                color:C.textSub,fontFamily:"'JetBrains Mono',monospace",
                fontSize:11,fontWeight:600,transition:"all 0.2s",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              ⬆&nbsp;UPLOAD .WPP FILE
            </button>
            <button className="run-btn" onClick={runAnalysis} disabled={loading}
              style={{flex:1.7,padding:"10px 0",background:C.teal,
                border:"none",borderRadius:7,color:"#fff",
                fontFamily:"'JetBrains Mono',monospace",fontSize:12,
                fontWeight:700,letterSpacing:0.5,transition:"background 0.2s",
                opacity:loading?0.7:1}}>
              {loading?"⏳ ANALYZING...":"▶  RUN ANALYSIS"}
            </button>
          </div>
          {error && <div style={{margin:"0 14px 10px",fontSize:11,color:"#c62828",
            fontFamily:"'JetBrains Mono',monospace",padding:"6px 10px",
            background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:6}}>{error}</div>}
        </div>

        {/* ══ RIGHT — REPORT ══ */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {!result ? (
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
              flexDirection:"column",gap:16}}>
              <div style={{fontSize:56,opacity:0.25}}>📊</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:C.textGhost}}>
                Write or upload W++ code, then click RUN ANALYSIS
              </div>
              <div style={{fontSize:11,color:C.textGhost,fontFamily:"'JetBrains Mono',monospace"}}>
                Sample code is pre-loaded — just click RUN ANALYSIS to try it
              </div>
            </div>
          ) : (<>

            {/* Report header */}
            <div style={{padding:"11px 20px",borderBottom:`1px solid ${C.border}`,
              background:C.rowAlt,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15}}>📈</span>
                <span style={{fontSize:11,fontWeight:700,color:C.textMid,letterSpacing:0.8}}>
                  2. LIVE STATISTICAL REPORT
                </span>
                <span style={{fontSize:11,color:C.textGhost,fontFamily:"'JetBrains Mono',monospace"}}>
                  — {result.filename}
                </span>
              </div>
              <span style={{fontSize:16,color:C.textGhost}}>ⓘ</span>
            </div>

            {/* Stat cards — 4 cards matching screenshot */}
            <div style={{display:"flex",background:C.panel,borderBottom:`1px solid ${C.border}`}}>
              {[
                {label:"TOTAL TOKENS",    value:result.meta.totalTokens,   accent:true},
                {label:"UNIQUE TYPES",    value:result.overallSummary.uniqueTokenTypes, accent:false},
                {label:"LINES OF CODE",   value:result.meta.linesWithCode,  accent:false},
                {label:"AVG TOKENS/LINE", value:result.overallSummary.averageTokensPerLine, accent:false},
              ].map((c,i)=>(
                <div key={c.label} style={{
                  flex:1,padding:"14px 18px",
                  borderRight:i<3?`1px solid ${C.borderInner}`:"none",
                  borderBottom:c.accent?`3px solid ${C.teal}`:"3px solid transparent",
                  background:c.accent?C.tealLight:C.panel
                }}>
                  <div style={{fontSize:10,color:C.textFaint,fontFamily:"'JetBrains Mono',monospace",
                    letterSpacing:1.2,marginBottom:5}}>{c.label}</div>
                  <div style={{fontSize:30,fontWeight:700,color:C.text,
                    fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Tab bar */}
            <div style={{display:"flex",background:C.panel,borderBottom:`1px solid ${C.border}`,
              paddingLeft:16,overflowX:"auto",flexShrink:0}}>
              {TABS.map(t=>(
                <button key={t.id} className="tab-btn" onClick={()=>setActiveTab(t.id)}
                  style={{
                    padding:"10px 14px",background:"transparent",border:"none",whiteSpace:"nowrap",
                    borderBottom:activeTab===t.id?`2.5px solid ${C.teal}`:"2.5px solid transparent",
                    color:activeTab===t.id?C.teal:C.textSub,
                    fontSize:11,fontWeight:activeTab===t.id?700:500,
                    fontFamily:"'JetBrains Mono',monospace",marginBottom:"-1px",transition:"color 0.15s"
                  }}>{t.label}</button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{flex:1,overflow:"auto",padding:"16px 18px",background:C.bg}}>

              {activeTab==="overview" && (
                <div>
                  <CategoryBreakdown data={result.categoryBreakdown} totalTokens={result.meta.totalTokens}/>
                  <TokenDetailTable tokens={result.rawTokens.slice(0,15)}/>
                  <div style={{fontSize:11,color:C.textGhost,fontFamily:"'JetBrains Mono',monospace",
                    marginBottom:8,cursor:"pointer"}} onClick={()=>setActiveTab("table")}>
                    → See all {result.rawTokens.length} tokens in "Token Table" tab
                  </div>
                </div>
              )}
              {activeTab==="token_type"  && <TokenTypeSummary data={result.tokenTypeSummary}/>}
              {activeTab==="line_dist"   && <LineDistribution data={result.lineDistribution}/>}
              {activeTab==="identifiers" && <IdentifierStats  data={result.identifierStats}/>}
              {activeTab==="literals"    && <LiteralStats     data={result.literalStats}/>}
              {activeTab==="summary"     && <OverallSummary   data={result.overallSummary}/>}
              {activeTab==="category"    && <CategoryBreakdown data={result.categoryBreakdown} totalTokens={result.meta.totalTokens}/>}
              {activeTab==="table"       && <TokenDetailTable tokens={result.rawTokens}/>}

            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
