import * as fs from "fs";
import * as path from "path";

interface Action {
  actionId: string;
  type: string;
  data: string;
}
interface Request {
  actionId: string;
  url: string;
  requestSource: string;
  method: string;
  status: number;
}

export async function generateLinkageReport(
  resultsPath: string
): Promise<string> {
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  const actions: Action[] = (results.parts || []).flatMap(
    (part: any) => part.actions || []
  );
  const requests: Request[] = results.requests || [];
  const actionMap = new Map(actions.map((a) => [a.actionId, a]));
  
  // Calculate linkage statistics
  const linkedRequests = requests.filter(req => actionMap.has(req.actionId));
  const unlinkedRequests = requests.filter(req => !actionMap.has(req.actionId));
  const linkageRate = requests.length > 0 ? (linkedRequests.length / requests.length * 100).toFixed(1) : '0.0';

  let report = "HTTP Request Linkage Report\n";
  report += "====================================\n";
  report += `Total Requests: ${requests.length}\n`;
  report += `Linked Requests: ${linkedRequests.length}\n`;
  report += `Unlinked Requests: ${unlinkedRequests.length}\n`;
  report += `Linkage Rate: ${linkageRate}%\n`;
  report += `Total Actions Detected: ${actions.length}\n\n`;
  
  // Group actions by type for summary
  const actionsByType = actions.reduce((acc, action) => {
    acc[action.type] = (acc[action.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  report += "Action Type Summary:\n";
  report += "-------------------\n";
  for (const [type, count] of Object.entries(actionsByType)) {
    report += `${type}: ${count}\n`;
  }
  report += "\n";
  
  report += "Detailed Request Linkage:\n";
  report += "========================\n";
  report +=
    "URL | Method | Source | Status | Linked Action Type | Linked Action Data\n";
  report +=
    "----|--------|--------|--------|-------------------|-------------------\n";

  // Show linked requests first
  for (const req of linkedRequests) {
    const action = actionMap.get(req.actionId)!;
    report += `${req.url} | ${req.method} | ${req.requestSource} | ${req.status} | ${action.type} | ${action.data}\n`;
  }
  
  // Then show unlinked requests with analysis
  if (unlinkedRequests.length > 0) {
    report += "\nUNLINKED REQUESTS (Debug Analysis):\n";
    report += "----------------------------------\n";
    for (const req of unlinkedRequests) {
      report += `${req.url} | ${req.method} | ${req.requestSource} | ${req.status} | unlinked | unlinked (actionId: ${req.actionId})\n`;
    }
    
    // Add debugging section
    report += "\nDebugging Information:\n";
    report += "=====================\n";
    report += `Unlinked ActionId patterns:\n`;
    const unlinkedActionIds = unlinkedRequests.map(req => req.actionId);
    const actionIdPatterns = unlinkedActionIds.reduce((acc, actionId) => {
      const prefix = actionId.split('_')[0];
      acc[prefix] = (acc[prefix] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [pattern, count] of Object.entries(actionIdPatterns)) {
      report += `  ${pattern}_*: ${count} occurrences\n`;
    }
    
    report += `\nLinked ActionId patterns:\n`;
    const linkedActionIds = actions.map(action => action.actionId);
    const linkedPatterns = linkedActionIds.reduce((acc, actionId) => {
      const prefix = actionId.split('_')[0];
      acc[prefix] = (acc[prefix] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [pattern, count] of Object.entries(linkedPatterns)) {
      report += `  ${pattern}_*: ${count} occurrences\n`;
    }
  }

  // Write report to linkage_report.txt in the same directory as results.json
  const outDir = path.dirname(resultsPath);
  const outPath = path.join(outDir, "linkage_report.txt");
  fs.writeFileSync(outPath, report, "utf-8");
  
  // Also log summary to console
  console.log(`\n=== Linkage Report Summary ===`);
  console.log(`Linkage Rate: ${linkageRate}% (${linkedRequests.length}/${requests.length})`);
  console.log(`Actions Detected: ${actions.length}`);
  console.log(`Report saved to: ${outPath}`);
  
  return report;
}

export async function generateHtmlLinkageReport(
  resultsPath: string
): Promise<string> {
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  const actions: Action[] = (results.parts || []).flatMap(
    (part: any) => part.actions || []
  );
  const requests: Request[] = results.requests || [];
  const actionMap = new Map(actions.map((a) => [a.actionId, a]));
  
  // Calculate linkage statistics
  const linkedRequests = requests.filter(req => actionMap.has(req.actionId));
  const failedRequests = requests.filter(req => req.status === -999);
  const unlinkedRequests = requests.filter(req => !actionMap.has(req.actionId) && req.status !== -999);
  const linkageRate = requests.length > 0 ? (linkedRequests.length / requests.length * 100).toFixed(1) : '0.0';
  
  // Group actions by type
  const actionsByType = actions.reduce((acc, action) => {
    acc[action.type] = (acc[action.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Group requests by source
  const requestsBySource = requests.reduce((acc, request) => {
    acc[request.requestSource] = (acc[request.requestSource] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Scanner Linkage Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 2.5em;
        }
        
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        
        .section {
            padding: 30px;
            border-bottom: 1px solid #eee;
        }
        
        .section h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        
        .linked-requests {
            background: #fff8e7;
            border-left: 4px solid #f39c12;
        }
        
        .linked-requests h2 {
            color: #f39c12;
        }
        
        .table-container {
            overflow-x: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        th {
            background: #667eea;
            color: white;
            padding: 15px 10px;
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
        }
        
        tr:hover {
            background-color: #f8f9fa;
        }
        
        .status-success {
            color: #28a745;
            font-weight: bold;
        }
        
        .status-error {
            color: #dc3545;
            font-weight: bold;
        }
        
        .action-type {
            background: #e3f2fd;
            color: #1976d2;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
        }
        
        .request-source {
            background: #f3e5f5;
            color: #7b1fa2;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
        }
        
        .url {
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .collapsible {
            background-color: #777;
            color: white;
            cursor: pointer;
            padding: 15px;
            width: 100%;
            border: none;
            text-align: left;
            outline: none;
            font-size: 1.1em;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        
        .collapsible:hover {
            background-color: #555;
        }
        
        .collapsible-content {
            display: none;
            overflow: hidden;
            background-color: #f8f9fa;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        
        .info {
            background: #d1ecf1;
            border: 1px solid #b6d4db;
            color: #0c5460;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .breakdown-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        
        .breakdown-item:last-child {
            border-bottom: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Web Scanner Linkage Report</h1>
            <p>Analysis of HTTP request correlations and sensitive data access patterns</p>
        </div>
        
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value">${linkedRequests.length}</div>
                <div class="metric-label">Linked Requests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #dc3545;">${failedRequests.length}</div>
                <div class="metric-label">Failed/Blocked Requests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${unlinkedRequests.length}</div>
                <div class="metric-label">Unlinked Requests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${actions.length}</div>
                <div class="metric-label">Actions Detected</div>
            </div>
        </div>
        
        ${linkedRequests.length > 0 ? `
        <div class="section linked-requests">
            <h2>🎯 Linked Requests (Action-Triggered)</h2>
            <div class="info">
                <strong>Important:</strong> These requests were triggered by user input access actions and may indicate data exfiltration attempts.
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Action Type</th>
                            <th>Action Data</th>
                            <th>Request URL</th>
                            <th>Method</th>
                            <th>Source</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linkedRequests.map(req => {
                          const action = actionMap.get(req.actionId)!;
                          return `
                            <tr>
                                <td><span class="action-type">${action.type}</span></td>
                                <td>${action.data}</td>
                                <td><span class="url" title="${req.url}">${req.url}</span></td>
                                <td><strong>${req.method}</strong></td>
                                <td><span class="request-source">${req.requestSource}</span></td>
                                <td><span class="${req.status >= 200 && req.status < 300 ? 'status-success' : 'status-error'}">${req.status}</span></td>
                            </tr>
                          `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
        
        ${failedRequests.length > 0 ? `
        <div class="section" style="background: #ffe6e6; border-left: 4px solid #dc3545;">
            <h2 style="color: #dc3545;">🚨 Failed/Blocked Requests (Potential Malicious Activity)</h2>
            <div class="warning">
                <strong>Security Alert:</strong> These requests failed or were blocked by browser security policies. They may represent attempted data exfiltration or malicious behavior.
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Request URL</th>
                            <th>Method</th>
                            <th>Source</th>
                            <th>Linked Action</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${failedRequests.map(req => {
                          const action = actionMap.get(req.actionId);
                          return `
                            <tr style="background-color: #fff5f5;">
                                <td><span class="url" title="${req.url}" style="color: #dc3545; font-weight: bold;">${req.url}</span></td>
                                <td><strong>${req.method}</strong></td>
                                <td><span class="request-source">${req.requestSource}</span></td>
                                <td>${action ? `<span class="action-type">${action.type}</span><br><small>${action.data}</small>` : '<span style="color: #999;">None</span>'}</td>
                                <td><span style="color: #dc3545; font-weight: bold;">BLOCKED</span></td>
                            </tr>
                          `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
        
        <div class="section">
            <h2>📊 Action Types Breakdown</h2>
            <div class="grid-2">
                <div>
                    <h3>Detected Actions</h3>
                    ${Object.entries(actionsByType).map(([type, count]) => `
                        <div class="breakdown-item">
                            <span><span class="action-type">${type}</span></span>
                            <strong>${count}</strong>
                        </div>
                    `).join('')}
                </div>
                <div>
                    <h3>Request Sources</h3>
                    ${Object.entries(requestsBySource).map(([source, count]) => `
                        <div class="breakdown-item">
                            <span><span class="request-source">${source}</span></span>
                            <strong>${count}</strong>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>📋 All Detected Actions</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Action ID</th>
                            <th>Type</th>
                            <th>Data</th>
                            <th>Linked Requests</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${actions.map(action => {
                          const relatedRequests = requests.filter(r => r.actionId === action.actionId);
                          return `
                            <tr>
                                <td><code>${action.actionId}</code></td>
                                <td><span class="action-type">${action.type}</span></td>
                                <td>${action.data}</td>
                                <td>${relatedRequests.length > 0 ? `<strong>${relatedRequests.length}</strong> requests` : '<span style="color: #999;">None</span>'}</td>
                            </tr>
                          `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="section">
            <button type="button" class="collapsible">📂 Unlinked Requests (Page Load Resources) - ${unlinkedRequests.length} items</button>
            <div class="collapsible-content">
                <div class="warning">
                    <strong>Note:</strong> These are normal page load resources (CSS, JS, images, fonts) that are not triggered by user input actions. This is expected behavior.
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>URL</th>
                                <th>Method</th>
                                <th>Source</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${unlinkedRequests.slice(0, 50).map(req => `
                                <tr>
                                    <td><span class="url" title="${req.url}">${req.url}</span></td>
                                    <td>${req.method}</td>
                                    <td><span class="request-source">${req.requestSource}</span></td>
                                    <td><span class="${req.status >= 200 && req.status < 300 ? 'status-success' : 'status-error'}">${req.status}</span></td>
                                </tr>
                            `).join('')}
                            ${unlinkedRequests.length > 50 ? `
                                <tr>
                                    <td colspan="4" style="text-align: center; color: #999; font-style: italic;">
                                        ... and ${unlinkedRequests.length - 50} more unlinked requests
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Make collapsible sections work
        document.querySelectorAll('.collapsible').forEach(button => {
            button.addEventListener('click', function() {
                this.classList.toggle('active');
                const content = this.nextElementSibling;
                if (content.style.display === 'block') {
                    content.style.display = 'none';
                } else {
                    content.style.display = 'block';
                }
            });
        });
        
        // Add row highlighting on click
        document.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', function() {
                // Remove previous highlights
                document.querySelectorAll('tr.highlighted').forEach(r => r.classList.remove('highlighted'));
                // Add highlight to clicked row
                this.classList.add('highlighted');
            });
        });
    </script>
    
    <style>
        .highlighted {
            background-color: #fff3cd !important;
            border-left: 4px solid #ffc107 !important;
        }
    </style>
</body>
</html>
  `;
  
  // Write HTML report
  const outDir = path.dirname(resultsPath);
  const htmlPath = path.join(outDir, "linkage_report.html");
  fs.writeFileSync(htmlPath, html, "utf-8");
  
  console.log(`HTML linkage report saved to: ${htmlPath}`);
  
  return html;
}

// Standalone usage: node src/results/linkageReport.js path/to/results.json
if (require.main === module) {
  const resultsPath = process.argv[2];
  if (!resultsPath) {
    console.error("Usage: node linkageReport.js path/to/results.json");
    process.exit(1);
  }
  generateLinkageReport(resultsPath).then((report) => {
    console.log(report);
  });
}
