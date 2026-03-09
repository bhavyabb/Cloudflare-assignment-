export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FeedbackPulse — Product Feedback Intelligence</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; }
    .spinner { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .priority-critical { background-color: #fef2f2; border-left: 4px solid #ef4444; }
    .priority-high { background-color: #fff7ed; border-left: 4px solid #f97316; }
    .priority-medium { background-color: #fefce8; border-left: 4px solid #eab308; }
    .priority-low { background-color: #f0fdf4; border-left: 4px solid #22c55e; }
    .badge-critical { background: #ef4444; color: white; }
    .badge-high { background: #f97316; color: white; }
    .badge-medium { background: #eab308; color: white; }
    .badge-low { background: #22c55e; color: white; }
    .badge-positive { background: #22c55e; color: white; }
    .badge-negative { background: #ef4444; color: white; }
    .badge-unknown { background: #6b7280; color: white; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- Header -->
  <header class="bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">FeedbackPulse</h1>
        <p class="text-orange-100 text-sm mt-1">Product Feedback Intelligence Dashboard</p>
      </div>
      <div class="flex gap-3">
        <button onclick="seedData()" id="btn-seed" class="bg-white text-orange-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 transition">Seed Data</button>
        <button onclick="runPipeline()" id="btn-pipeline" class="bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-800 transition">Run Pipeline</button>
        <button onclick="exportR2()" id="btn-export" class="bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/30 transition">Export to R2</button>
      </div>
    </div>
  </header>

  <!-- Status Bar -->
  <div id="status-bar" class="hidden bg-blue-50 border-b border-blue-200">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
      <svg class="spinner w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
      <span id="status-text" class="text-blue-700 text-sm font-medium">Processing...</span>
    </div>
  </div>

  <main class="max-w-7xl mx-auto px-4 py-6 space-y-6">
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white rounded-xl shadow-sm border p-5">
        <p class="text-gray-500 text-xs uppercase tracking-wider font-medium">Total Feedback</p>
        <p id="stat-total" class="text-3xl font-bold text-gray-900 mt-1">—</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border p-5">
        <p class="text-gray-500 text-xs uppercase tracking-wider font-medium">Sources</p>
        <p id="stat-sources" class="text-3xl font-bold text-gray-900 mt-1">—</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border p-5">
        <p class="text-gray-500 text-xs uppercase tracking-wider font-medium">Pipeline Status</p>
        <p id="stat-pipeline" class="text-sm font-medium text-gray-700 mt-2">Not run yet</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm border p-5">
        <p class="text-gray-500 text-xs uppercase tracking-wider font-medium">Urgency Breakdown</p>
        <div id="stat-urgency" class="mt-2 space-y-1"></div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm border p-5">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Feedback by Source</h3>
        <canvas id="sourceChart" height="260"></canvas>
      </div>
      <div class="bg-white rounded-xl shadow-sm border p-5">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Sentiment Distribution</h3>
        <canvas id="sentimentChart" height="260"></canvas>
      </div>
    </div>

    <!-- Priority Matrix -->
    <div class="bg-white rounded-xl shadow-sm border">
      <div class="px-5 py-4 border-b">
        <h3 class="text-sm font-semibold text-gray-700">Priority Matrix</h3>
        <p class="text-xs text-gray-500 mt-1">AI-generated product area prioritization</p>
      </div>
      <div id="priority-matrix" class="divide-y">
        <p class="p-5 text-gray-400 text-sm">Run the pipeline to generate the priority matrix.</p>
      </div>
    </div>

    <!-- Action Items -->
    <div class="bg-white rounded-xl shadow-sm border">
      <div class="px-5 py-4 border-b">
        <h3 class="text-sm font-semibold text-gray-700">Action Items</h3>
      </div>
      <div id="action-items" class="p-5">
        <p class="text-gray-400 text-sm">Run the pipeline to generate action items.</p>
      </div>
    </div>

    <!-- Recent Feedback -->
    <div class="bg-white rounded-xl shadow-sm border">
      <div class="px-5 py-4 border-b flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-700">Recent Feedback</h3>
        <div class="flex gap-2">
          <select id="filter-source" onchange="loadFeedback()" class="text-xs border rounded-md px-2 py-1">
            <option value="">All Sources</option>
            <option value="discord">Discord</option>
            <option value="github">GitHub</option>
            <option value="support">Support</option>
            <option value="twitter">Twitter</option>
            <option value="email">Email</option>
            <option value="forum">Forum</option>
          </select>
          <select id="filter-urgency" onchange="loadFeedback()" class="text-xs border rounded-md px-2 py-1">
            <option value="">All Urgency</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select id="filter-sentiment" onchange="loadFeedback()" class="text-xs border rounded-md px-2 py-1">
            <option value="">All Sentiment</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urgency</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sentiment</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Area</th>
            </tr>
          </thead>
          <tbody id="feedback-table" class="divide-y">
            <tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Seed data to see feedback</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Slack Preview -->
    <div class="bg-white rounded-xl shadow-sm border">
      <div class="px-5 py-4 border-b">
        <h3 class="text-sm font-semibold text-gray-700">Slack Digest Preview</h3>
      </div>
      <div id="slack-preview" class="p-5 bg-gray-50 font-mono text-xs">
        <p class="text-gray-400">Run the pipeline to preview the Slack digest.</p>
      </div>
    </div>
  </main>

  <footer class="max-w-7xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
    FeedbackPulse — Built on Cloudflare Workers, D1, R2, KV, Workers AI, and Workflows
  </footer>

  <script>
    let sourceChart, sentimentChart;

    function showStatus(msg) {
      document.getElementById('status-bar').classList.remove('hidden');
      document.getElementById('status-text').textContent = msg;
    }
    function hideStatus() {
      document.getElementById('status-bar').classList.add('hidden');
    }
    function badge(text, type) {
      return '<span class="badge-' + (type || text) + ' px-2 py-0.5 rounded-full text-xs font-medium">' + text + '</span>';
    }

    async function seedData() {
      showStatus('Seeding 250 feedback entries into D1...');
      document.getElementById('btn-seed').disabled = true;
      try {
        const res = await fetch('/api/seed', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showStatus('Seeded ' + data.inserted + ' entries successfully!');
          setTimeout(() => { hideStatus(); loadStats(); loadFeedback(); }, 2000);
        } else {
          showStatus('Error: ' + (data.error || 'Unknown'));
        }
      } catch (e) {
        showStatus('Error: ' + e.message);
      }
      document.getElementById('btn-seed').disabled = false;
    }

    async function runPipeline() {
      showStatus('Starting analysis pipeline...');
      document.getElementById('btn-pipeline').disabled = true;
      try {
        const res = await fetch('/api/run-pipeline', { method: 'POST' });
        const data = await res.json();
        if (data.instanceId) {
          pollPipeline(data.instanceId);
        }
      } catch (e) {
        showStatus('Error: ' + e.message);
        document.getElementById('btn-pipeline').disabled = false;
      }
    }

    async function pollPipeline(id) {
      const poll = async () => {
        try {
          const res = await fetch('/api/pipeline/' + id);
          const data = await res.json();
          const status = data.status || data;
          if (status === 'complete' || status?.status === 'complete') {
            showStatus('Pipeline complete! Refreshing data...');
            setTimeout(() => { hideStatus(); loadAll(); }, 1500);
            document.getElementById('btn-pipeline').disabled = false;
            return;
          } else if (status === 'errored' || status?.status === 'errored') {
            showStatus('Pipeline errored. Check logs.');
            document.getElementById('btn-pipeline').disabled = false;
            return;
          }
          showStatus('Pipeline running... (' + (status?.status || status || 'working') + ')');
          setTimeout(poll, 3000);
        } catch {
          setTimeout(poll, 5000);
        }
      };
      poll();
    }

    async function exportR2() {
      showStatus('Exporting feedback to R2...');
      try {
        const res = await fetch('/api/export-to-r2', { method: 'POST' });
        const data = await res.json();
        showStatus('Exported ' + data.exported + ' items to R2.');
        setTimeout(hideStatus, 2000);
      } catch (e) {
        showStatus('Error: ' + e.message);
      }
    }

    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('stat-total').textContent = data.total || 0;
        document.getElementById('stat-sources').textContent = (data.bySource || []).length;
        if (data.lastPipelineRun) {
          document.getElementById('stat-pipeline').innerHTML = '<span class="text-green-600">Last run: ' + new Date(data.lastPipelineRun).toLocaleString() + '</span>';
        }

        // Urgency breakdown
        const urg = document.getElementById('stat-urgency');
        urg.innerHTML = (data.byUrgency || []).map(function(u) {
          return '<div class="flex justify-between text-xs"><span>' + badge(u.computed_urgency || 'unknown', u.computed_urgency) + '</span><span class="font-medium">' + u.c + '</span></div>';
        }).join('');

        // Source chart
        if (data.bySource && data.bySource.length) {
          const labels = data.bySource.map(function(s) { return s.source; });
          const values = data.bySource.map(function(s) { return s.c; });
          const colors = ['#f97316','#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b'];
          if (sourceChart) sourceChart.destroy();
          sourceChart = new Chart(document.getElementById('sourceChart'), {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: values, backgroundColor: colors }] },
            options: { responsive: true, plugins: { legend: { position: 'right' } } }
          });
        }

        // Sentiment chart
        if (data.bySentiment && data.bySentiment.length) {
          const labels = data.bySentiment.map(function(s) { return s.sentiment || 'unknown'; });
          const values = data.bySentiment.map(function(s) { return s.c; });
          const colors = labels.map(function(l) { return l === 'positive' ? '#22c55e' : l === 'negative' ? '#ef4444' : '#6b7280'; });
          if (sentimentChart) sentimentChart.destroy();
          sentimentChart = new Chart(document.getElementById('sentimentChart'), {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Count', data: values, backgroundColor: colors }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
          });
        }
      } catch (e) {
        console.error('Failed to load stats:', e);
      }
    }

    async function loadSummary() {
      try {
        const res = await fetch('/api/daily-summary');
        const data = await res.json();
        if (!data || !data.priority_matrix) return;

        // Priority Matrix
        const matrix = document.getElementById('priority-matrix');
        if (data.priority_matrix.length) {
          matrix.innerHTML = data.priority_matrix.map(function(item) {
            const p = item.priority || 'medium';
            const issues = (item.top_issues || []).join(', ') || item.recommendation || '—';
            return '<div class="priority-' + p + ' px-5 py-4 flex items-center justify-between">' +
              '<div class="flex-1"><span class="font-medium text-gray-900">' + (item.product_area || 'Unknown') + '</span>' +
              '<p class="text-xs text-gray-500 mt-1 line-clamp-1">' + issues + '</p></div>' +
              '<div class="flex items-center gap-4">' + badge(p, p) +
              '<span class="text-sm font-medium text-gray-700 w-16 text-right">' + (item.issue_count || 0) + ' issues</span></div></div>';
          }).join('');
        }

        // Action Items
        const actions = document.getElementById('action-items');
        if (data.action_items && data.action_items.length) {
          actions.innerHTML = '<ol class="list-decimal list-inside space-y-2">' +
            data.action_items.map(function(a) {
              return '<li class="text-sm text-gray-700">' + a + '</li>';
            }).join('') + '</ol>';
        }
      } catch (e) {
        console.error('Failed to load summary:', e);
      }
    }

    async function loadFeedback() {
      try {
        const source = document.getElementById('filter-source').value;
        const urgency = document.getElementById('filter-urgency').value;
        const sentiment = document.getElementById('filter-sentiment').value;
        let url = '/api/feedback?limit=50';
        if (source) url += '&source=' + source;
        if (urgency) url += '&urgency=' + urgency;
        if (sentiment) url += '&sentiment=' + sentiment;

        const res = await fetch(url);
        const data = await res.json();
        const tbody = document.getElementById('feedback-table');

        if (!data.results || !data.results.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No feedback found. Seed data first.</td></tr>';
          return;
        }

        tbody.innerHTML = data.results.map(function(r) {
          const urg = r.computed_urgency || r.urgency || '';
          const sent = r.sentiment || '';
          return '<tr class="hover:bg-gray-50">' +
            '<td class="px-4 py-3"><span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">' + r.source + '</span></td>' +
            '<td class="px-4 py-3 text-xs text-gray-600 max-w-[120px] truncate">' + r.author + '</td>' +
            '<td class="px-4 py-3 text-xs text-gray-700 max-w-[400px] truncate">' + r.content.substring(0, 150) + '</td>' +
            '<td class="px-4 py-3">' + (urg ? badge(urg, urg) : '<span class="text-gray-300 text-xs">—</span>') + '</td>' +
            '<td class="px-4 py-3">' + (sent ? badge(sent, sent) : '<span class="text-gray-300 text-xs">—</span>') + '</td>' +
            '<td class="px-4 py-3 text-xs text-gray-600">' + (r.product_area || '—') + '</td></tr>';
        }).join('');
      } catch (e) {
        console.error('Failed to load feedback:', e);
      }
    }

    async function loadSlack() {
      try {
        const res = await fetch('/api/slack-payload');
        const data = await res.json();
        if (data.blocks && data.blocks.length > 1) {
          const preview = document.getElementById('slack-preview');
          preview.innerHTML = '<div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3 max-w-lg">' +
            data.blocks.map(function(b) {
              if (b.type === 'header') return '<p class="font-bold text-base">' + b.text.text + '</p>';
              if (b.type === 'divider') return '<hr class="border-gray-200">';
              if (b.type === 'section' && b.text) return '<p class="text-sm whitespace-pre-wrap">' + b.text.text.replace(/\\*/g, '') + '</p>';
              return '';
            }).join('') + '</div>';
        }
      } catch (e) {
        console.error('Failed to load slack:', e);
      }
    }

    function loadAll() {
      loadStats();
      loadSummary();
      loadFeedback();
      loadSlack();
    }

    // Load on page start
    loadAll();
  </script>
</body>
</html>`;
}
