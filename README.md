# JSON Viewer App

A lightweight React app that parses and displays nested JSON data with syntax highlighting and copy functionality.

## Features

- 📄 **Parsed JSON View** - Automatically converts all nested JSON strings into proper JSON objects
- 📋 **Raw JSON View** - View the original data with JSON strings intact
- 🎨 **Syntax Highlighting** - Color-coded JSON elements for better readability
- 📋 **Copy to Clipboard** - One-click copy functionality
- 🔽 **Collapsible Sections** - Click on brackets to expand/collapse objects and arrays
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

## Usage

- Toggle between **Parsed JSON** and **Raw JSON** views using the buttons at the top
- Click on `{` or `[` brackets to collapse/expand sections
- Click the **Copy JSON** button to copy the current view to clipboard

## Technology Stack

- React 18
- Vite
- Pure CSS (no heavy UI libraries)

## File Structure

```
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── components/
│       ├── JsonViewer.jsx
│       └── JsonViewer.css
```

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Preview Production Build

```bash
npm run preview
```
