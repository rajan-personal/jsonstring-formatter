import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';

// Sample data with nested JSON strings
const sampleData = {
  "ai": {
    "model": { "id": "models/gemini-flash-lite-latest", "provider": "google.generative-ai" },
    "usage": { "promptTokens": 133, "completionTokens": 41 },
    "prompt": {
      "tools": [
        "{\"type\":\"function\",\"name\":\"getWeather\",\"description\":\"Get current weather for a location\",\"parameters\":{\"type\":\"object\",\"properties\":{\"location\":{\"type\":\"string\"}},\"required\":[\"location\"]}}",
      ],
      "messages": "[{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"What is the weather in LA?\"}]}]"
    },
    "response": {
      "toolCalls": "[{\"toolCallType\":\"function\",\"toolCallId\":\"abc123\",\"toolName\":\"getWeather\",\"args\":\"{\\\"location\\\":\\\"LA\\\"}\"}]"
    }
  }
};

// Recursively parse JSON strings
function parseNestedJson(obj) {
  if (typeof obj === 'string') {
    try {
      return parseNestedJson(JSON.parse(obj));
    } catch {
      return obj;
    }
  }
  if (Array.isArray(obj)) return obj.map(parseNestedJson);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, parseNestedJson(v)]));
  }
  return obj;
}

// Build line mapping from parsed to original
function buildLineMapping(originalStr, parsedStr) {
  const origLines = originalStr.split('\n');
  const parsedLines = parsedStr.split('\n');
  const mapping = new Map();
  
  let origIdx = 0;
  for (let parsedIdx = 0; parsedIdx < parsedLines.length; parsedIdx++) {
    const parsedLine = parsedLines[parsedIdx].trim();
    const parsedKey = parsedLine.match(/"([^"]+)":/);
    
    // Try to find matching key in original
    for (let i = origIdx; i < origLines.length && i < origIdx + 20; i++) {
      const origLine = origLines[i].trim();
      const origKey = origLine.match(/"([^"]+)":/);
      if (parsedKey && origKey && parsedKey[1] === origKey[1]) {
        mapping.set(parsedIdx + 1, i + 1);
        origIdx = i + 1;
        break;
      }
    }
  }
  return mapping;
}

// Monaco Editor options - now moved inside component to use state

function App() {
  const [input, setInput] = useState(JSON.stringify(sampleData, null, 2));
  const [parsed, setParsed] = useState(parseNestedJson(sampleData));
  const [error, setError] = useState('');
  const [view, setView] = useState('split');
  const [copiedOrig, setCopiedOrig] = useState(false);
  const [copiedParsed, setCopiedParsed] = useState(false);
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('splitRatio');
    return saved ? Number(saved) : 50;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [tabSize, setTabSize] = useState(() => {
    const saved = localStorage.getItem('tabSize');
    return saved ? Number(saved) : 4;
  });
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('fontSize');
    return saved ? Number(saved) : 14;
  });
  const panelsRef = useRef(null);
  const originalEditorRef = useRef(null);
  const parsedEditorRef = useRef(null);
  // Monaco Editor options with dynamic fontSize
  const editorOptions = useMemo(() => ({
    readOnly: true,
    minimap: { enabled: false },
    fontSize: fontSize,
    tabSize: tabSize,
    lineNumbers: 'on',
    folding: true,
    foldingStrategy: 'indentation',
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    automaticLayout: true,
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    padding: { top: 8, bottom: 8 },
    renderLineHighlight: 'none',
    guides: {
      indentation: true,
      bracketPairs: false,
    },
  }), [fontSize, tabSize]);

  const inputEditorOptions = useMemo(() => ({
    ...editorOptions,
    readOnly: false,
    lineNumbers: 'on',
  }), [editorOptions]);
  const parsedStr = JSON.stringify(parsed, null, tabSize);
  
  // Build line mapping for parsed editor
  const lineMapping = useMemo(() => buildLineMapping(input, parsedStr), [input, parsedStr]);

  // Save tab size to local storage
  useEffect(() => {
    localStorage.setItem('tabSize', tabSize);
  }, [tabSize]);

  // Save font size to local storage
  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);

  // Save split ratio to local storage
  useEffect(() => {
    localStorage.setItem('splitRatio', splitRatio);
  }, [splitRatio]);

  // Auto-parse whenever input changes
  useEffect(() => {
    try {
      const obj = JSON.parse(input);
      setParsed(parseNestedJson(obj));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [input]);

  // Resizable split
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      if (!panelsRef.current) return;
      const rect = panelsRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.min(80, Math.max(20, (x / rect.width) * 100));
      setSplitRatio(ratio);
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const copy = useCallback((text, setCopied) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const handleFormatOriginal = useCallback(() => {
    try {
      const formatted = JSON.stringify(JSON.parse(input), null, tabSize);
      setInput(formatted);
      
      // Reset cursor and scroll position to top-left after formatting
      setTimeout(() => {
        if (originalEditorRef.current) {
          const editor = originalEditorRef.current;
          // Set cursor to position (1,1) - top left
          editor.setPosition({ lineNumber: 1, column: 1 });
          // Scroll to top
          editor.setScrollTop(0);
          editor.setScrollLeft(0);
          // Reveal the position to ensure it's visible
          editor.revealPosition({ lineNumber: 1, column: 1 });
        }
      }, 0);
    } catch {
      // Invalid JSON, do nothing
    }
  }, [input, tabSize]);

  const handleOriginalMount = (editor, monaco) => {
    originalEditorRef.current = editor;
    
    monaco.editor.defineTheme('json-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '7aa2f7' },
        { token: 'string.value.json', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'keyword', foreground: '569cd6' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.lineHighlightBackground': '#151515',
        'editorLineNumber.foreground': '#3a3a3a',
        'editorLineNumber.activeForeground': '#666666',
        'editor.selectionBackground': '#264f78',
        'editorGutter.background': '#080808',
        'editorIndentGuide.background': '#1a1a1a',
        'editorBracketMatch.background': '#1a1a1a',
        'editorBracketMatch.border': '#3a3a3a',
      }
    });
    monaco.editor.setTheme('json-dark');
  };

  const handleParsedMount = (editor, monaco) => {
    parsedEditorRef.current = editor;
    
    // Custom line numbers showing original line mapping
    editor.updateOptions({
      lineNumbers: (lineNumber) => {
        const origLine = lineMapping.get(lineNumber);
        return origLine ? `${origLine}` : `${lineNumber}`;
      },
      lineNumbersMinChars: 4,
    });
    
    monaco.editor.defineTheme('json-dark-parsed', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '4ec9b0' },
        { token: 'string.value.json', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'keyword', foreground: '569cd6' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.lineHighlightBackground': '#0a0a0a',
        'editorLineNumber.foreground': '#4a4a4a',
        'editorLineNumber.activeForeground': '#888888',
        'editor.selectionBackground': '#264f78',
        'editorGutter.background': '#080808',
        'editorIndentGuide.background': '#1a1a1a',
        'editorBracketMatch.background': '#1a1a1a',
        'editorBracketMatch.border': '#3a3a3a',
      }
    });
    monaco.editor.setTheme('json-dark-parsed');
  };

  // Update parsed editor line numbers when mapping changes
  useEffect(() => {
    if (parsedEditorRef.current) {
      parsedEditorRef.current.updateOptions({
        lineNumbers: (lineNumber) => {
          const origLine = lineMapping.get(lineNumber);
          return origLine ? `${origLine}` : `${lineNumber}`;
        }
      });
    }
  }, [lineMapping]);

  return (
    <div className="app">
      <div className="toolbar">
        <span className="toolbar-title">
          JSON Diff
        </span>

        <div className="toolbar-controls">
          <div className="control-group">
            <label htmlFor="tab-size">Tab Size:</label>
            <select 
              id="tab-size"
              value={tabSize} 
              onChange={(e) => setTabSize(Number(e.target.value))}
              className="select"
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="font-size">Text Size:</label>
            <select 
              id="font-size"
              value={fontSize} 
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="select"
            >
              <option value={10}>10px</option>
              <option value={12}>12px</option>
              <option value={14}>14px</option>
              <option value={16}>16px</option>
              <option value={18}>18px</option>
              <option value={20}>20px</option>
            </select>
          </div>
        </div>

        <div className="view-tabs">
          <button className={`btn ${view === 'original' ? 'active' : ''}`} onClick={() => setView('original')}>
            Original
          </button>
          <button className={`btn ${view === 'split' ? 'active' : ''}`} onClick={() => setView('split')}>
            Split
          </button>
          <button className={`btn ${view === 'parsed' ? 'active' : ''}`} onClick={() => setView('parsed')}>
            Parsed
          </button>
        </div>
        
        <a 
          href="https://github.com/rajan-personal/jsonstring-formatter" 
          target="_blank" 
          rel="noopener noreferrer"
          className="github-link"
          title="View on GitHub"
        >
          <svg height="20" width="20" viewBox="0 0 16 16" style={{ verticalAlign: 'middle' }}>
            <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
        </a>
      </div>

      {error && <div className="error-bar">Error: {error}</div>}

      <div className="main">
        <div className={`panels ${view !== 'split' ? 'single' : ''} ${isDragging ? 'dragging' : ''}`} ref={panelsRef}>
          
          {/* Original Panel - now editable as input */}
          <div 
            className={`panel ${view === 'parsed' ? '' : 'visible'}`}
            style={view === 'split' ? { flex: `0 0 ${splitRatio}%` } : undefined}
          >
            <div className="panel-header">
              <span className="panel-label">Original (Input)</span>
              <button 
                className="btn btn-small"
                onClick={handleFormatOriginal}
                title="Format original JSON"
              >
                Format
              </button>
              <button 
                className={`btn ${copiedOrig ? 'copied' : ''}`} 
                onClick={() => copy(input, setCopiedOrig)}
              >
                {copiedOrig ? '✓' : 'Copy'}
              </button>
            </div>
            <div className="panel-content">
              <Editor
                height="100%"
                language="json"
                value={input}
                onChange={(value) => setInput(value || '')}
                options={inputEditorOptions}
                onMount={handleOriginalMount}
                theme="json-dark"
              />
            </div>
          </div>

          {/* Resize Handle */}
          {view === 'split' && (
            <div className="resize-handle" onMouseDown={handleMouseDown}>
              <div className="resize-line" />
            </div>
          )}

          {/* Parsed Panel */}
          <div 
            className={`panel ${view === 'original' ? '' : 'visible'}`}
            style={view === 'split' ? { flex: `0 0 ${100 - splitRatio}%` } : undefined}
          >
            <div className="panel-header">
              <span className="panel-label">Parsed</span>
              <span className="panel-hint">shows orig line #</span>
              <button 
                className={`btn ${copiedParsed ? 'copied' : ''}`} 
                onClick={() => copy(parsedStr, setCopiedParsed)}
              >
                {copiedParsed ? '✓' : 'Copy'}
              </button>
            </div>
            <div className="panel-content">
              <Editor
                height="100%"
                language="json"
                value={parsedStr}
                options={editorOptions}
                onMount={handleParsedMount}
                theme="json-dark-parsed"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
