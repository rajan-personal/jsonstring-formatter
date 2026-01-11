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

// Monaco Editor options
const editorOptions = {
  readOnly: true,
  minimap: { enabled: false },
  fontSize: 12,
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
};

const inputEditorOptions = {
  ...editorOptions,
  readOnly: false,
  lineNumbers: 'on',
};

function App() {
  const [input, setInput] = useState(JSON.stringify(sampleData, null, 2));
  const [parsed, setParsed] = useState(parseNestedJson(sampleData));
  const [error, setError] = useState('');
  const [view, setView] = useState('split');
  const [copiedOrig, setCopiedOrig] = useState(false);
  const [copiedParsed, setCopiedParsed] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [syncScroll, setSyncScroll] = useState(true);
  const panelsRef = useRef(null);
  const originalEditorRef = useRef(null);
  const parsedEditorRef = useRef(null);
  const isScrolling = useRef(false);

  const parsedStr = JSON.stringify(parsed, null, 2);
  
  // Build line mapping for parsed editor
  const lineMapping = useMemo(() => buildLineMapping(input, parsedStr), [input, parsedStr]);

  const handleParse = useCallback(() => {
    try {
      const obj = JSON.parse(input);
      setParsed(parseNestedJson(obj));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [input]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleParse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleParse]);

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

  const handleOriginalMount = (editor, monaco) => {
    originalEditorRef.current = editor;
    
    // Scroll sync from original to parsed
    editor.onDidScrollChange((e) => {
      if (!syncScroll || isScrolling.current || !parsedEditorRef.current) return;
      isScrolling.current = true;
      parsedEditorRef.current.setScrollTop(e.scrollTop);
      setTimeout(() => { isScrolling.current = false; }, 50);
    });
    
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
    
    // Scroll sync from parsed to original
    editor.onDidScrollChange((e) => {
      if (!syncScroll || isScrolling.current || !originalEditorRef.current) return;
      isScrolling.current = true;
      originalEditorRef.current.setScrollTop(e.scrollTop);
      setTimeout(() => { isScrolling.current = false; }, 50);
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
          JSON Diff<kbd>⌘↵ parse</kbd>
        </span>

        <button 
          className={`btn btn-small ${syncScroll ? 'active' : ''}`} 
          onClick={() => setSyncScroll(!syncScroll)}
          title="Sync scroll between panels"
        >
          {syncScroll ? '🔗' : '🔓'}
        </button>

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

        <button className="btn btn-primary" onClick={handleParse}>
          Parse
        </button>
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
