# 🔍 Baby Explorer - Web Page Security Scanner

A sophisticated Node.js application built with TypeScript and Puppeteer that monitors web pages for sensitive data access patterns and potential security vulnerabilities. This scanner tracks any mechanisms that could potentially read or access user input values, form data, or other sensitive information.

## 🎯 Mission

**Monitor Sensitive Data Access:** Detect and document any way that scripts, events, or network requests could access sensitive user data such as input values, form contents, or personal information. The scanner provides comprehensive analysis of potential data exfiltration attempts and security vulnerabilities.

## ✨ Key Features

- **🔒 Input Value Monitoring**: Tracks direct access to input element values
- **📝 Event Listener Detection**: Monitors event listeners attached to forms and input elements
- **🌐 HTTP Request Correlation**: Links network requests back to the actions that triggered them
- **🚨 Security Analysis**: Identifies potential malicious behavior and blocked requests
- **📊 Rich Reporting**: Generates both text and HTML reports with detailed linkage analysis
- **⚡ Real-time Monitoring**: Active scanning with browser automation
- **🎯 Action Traceability**: Robust linking between user actions and resulting network requests

## 🏗️ Architecture

The project follows a modular architecture with clear separation of concerns:

```
src/
├── scanner.ts              # Main scanner orchestration
├── monitors/
│   ├── inputMonitor.ts     # Input value and event listener monitoring
│   └── requestMonitor.ts   # HTTP request tracking and correlation
├── results/
│   ├── resultAggregator.ts # Data aggregation and validation
│   └── linkageReport.ts    # Report generation (text & HTML)
├── types/
│   └── scanTypes.ts        # TypeScript type definitions
└── tests/
    ├── test_scanner.ts     # Test runner
    └── test-malicious-behavior.html # Test page with controlled malicious behavior
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd baby-explorer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the scanner**
   ```bash
   npm run test:scanner
   ```

### Usage

1. **Start a scan**: The scanner will launch a browser window and navigate to the test page
2. **Interact with the page**: Use the test interface to trigger various security scenarios
3. **Complete the scan**: Open browser DevTools (F12) and run `finishScan()` in the console
4. **Review results**: Check the generated reports in the `history/` directory

## 📋 Test Scenarios

The included test page (`src/tests/test-malicious-behavior.html`) provides controlled scenarios to validate scanner functionality:

- **Test 1**: Direct action → successful request (should be linked)
- **Test 2**: Action → CORS-blocked request (should be detected as failed)
- **Test 3**: Multiple actions → multiple requests (complex correlation)
- **Test 4**: Form submission with event listeners
- **Test 5**: Delayed requests (tests timing correlation)
- **Test 6**: Rapid-fire multiple requests (stress test)

## 📊 Output Structure

### JSON Results Format

```json
{
  "parts": [
    {
      "id": "part_html_main",
      "type": "html",
      "actions": [
        {
          "actionId": "action_1234567890_abc123",
          "type": "input.value",
          "data": "id=username"
        }
      ]
    }
  ],
  "requests": [
    {
      "actionId": "action_1234567890_abc123",
      "url": "https://api.example.com/data",
      "requestSource": "fetch",
      "method": "POST",
      "status": 200
    }
  ],
  "extraPages": []
}
```

### Generated Reports

Each scan generates three files in the `history/[timestamp]/` directory:

1. **`results.json`** - Raw scan data in structured format
2. **`linkage_report.txt`** - Text-based analysis report
3. **`linkage_report.html`** - Interactive HTML report with visualizations

## 🔍 Monitoring Capabilities

### Input Access Detection

- **Direct value reads**: `input.value` property access
- **Event listeners**: `change`, `input`, `keyup`, `keydown` events
- **Form submissions**: `submit` event handlers
- **Element identification**: Supports ID, name, or position-based identification

### Request Correlation

- **Fetch API**: Monitors `window.fetch()` calls
- **XMLHttpRequest**: Tracks XHR requests
- **Resource loading**: CSS, JS, images, fonts, and other resources
- **Status tracking**: Success, failure, and blocked request detection

### Security Analysis

- **Linkage validation**: Verifies action-request correlations
- **Failed request detection**: Identifies blocked or failed requests
- **Pattern analysis**: Groups similar behaviors for analysis
- **Timing correlation**: Handles delayed and rapid-fire requests

## 🛠️ Development

### Project Structure

```
baby-explorer/
├── src/                    # Source code
│   ├── monitors/          # Monitoring modules
│   ├── results/           # Data processing and reporting
│   ├── types/             # TypeScript definitions
│   └── tests/             # Test files
├── history/               # Scan results (auto-generated)
├── package.json           # Dependencies and scripts
└── tsconfig.json          # TypeScript configuration
```

### Key Components

#### Scanner (`src/scanner.ts`)

Main orchestration class that:

- Launches Puppeteer browser
- Sets up monitoring systems
- Manages scan lifecycle
- Generates reports

#### InputMonitor (`src/monitors/inputMonitor.ts`)

Monitors sensitive data access:

- Intercepts `input.value` property access
- Wraps event listeners for input elements and forms
- Maintains action context for correlation

#### RequestMonitor (`src/monitors/requestMonitor.ts`)

Tracks HTTP requests:

- Monitors fetch and XMLHttpRequest calls
- Correlates requests with triggering actions
- Handles request failures and CORS blocks

#### ResultAggregator (`src/results/resultAggregator.ts`)

Data management:

- Aggregates scan data
- Validates action-request linkages
- Provides statistics and analysis

### Available Scripts

- `npm run test:scanner` - Run the scanner test suite
- `npm test` - Run tests (placeholder)

## 📈 Performance & Statistics

The scanner provides comprehensive statistics including:

- **Linkage Rate**: Percentage of requests successfully linked to actions
- **Action Types**: Breakdown of detected input access patterns
- **Request Sources**: Analysis of HTTP request origins
- **Failed Requests**: Identification of blocked or failed requests
- **Timing Analysis**: Correlation of delayed and rapid requests

## 🔧 Configuration

### Browser Settings

The scanner launches with the following Puppeteer configuration:

- **Headless**: `false` (visible browser for debugging)
- **Viewport**: Maximized window
- **Wait Strategy**: `networkidle2` for page navigation

### Monitoring Parameters

- **Action Context**: 100ms timeout for action correlation
- **Request Mapping**: Automatic cleanup of old mappings
- **Resource Tracking**: All resource types (HTML, JS, CSS, images, fonts, etc.)

## 🚨 Security Considerations

This scanner is designed for **security research and testing purposes only**. It:

- **Does not modify** the target pages or their behavior
- **Does not store** actual sensitive data values
- **Only tracks** access patterns and request correlations
- **Generates reports** for analysis and security assessment

## 📚 Documentation

For detailed technical documentation, see:

- `web_scanner_assignment_prd.md` - Original project requirements
- `src/types/scanTypes.ts` - Type definitions
- Generated reports in `history/` directory for examples

---

**⚠️ Disclaimer**: This tool is for educational and security research purposes. Always ensure you have proper authorization before scanning any websites.
