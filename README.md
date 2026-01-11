# JSON String Formatter

A lightweight React app that parses nested JSON strings and displays formatted JSON with syntax highlighting.

## Example

Input:
```json
{
  "data": "{\"name\":\"John\",\"age\":30}"
}
```

Output:
```json
{
  "data": {
    "name": "John",
    "age": 30
  }
}
```

## Quick Start

```bash
npm install
npm run dev
```

## Features

- Parse nested JSON strings automatically
- Syntax highlighting with Monaco Editor
- Split view to compare original vs parsed
- Copy to clipboard
- Resizable panels

## Build

```bash
npm run build
```
