

# Get work done for today using ActivityWatch Query
## query for top apps:
{
  "timeperiods": [
    "2025-03-19T00:00:00/2025-03-19T23:59:59"
  ],
  "query": [
    "window_events = query_bucket('aw-watcher-window_nb235988'); afk_events = query_bucket('aw-watcher-afk_nb235988'); not_afk = filter_keyvals(afk_events, 'status', ['not-afk']); active_events = filter_period_intersect(window_events, not_afk); events_by_app = merge_events_by_keys(active_events, ['app']); RETURN = sort_by_duration(events_by_app);"
  ]
}

## query for Firefox URLs:
{
  "timeperiods": [
    "2025-03-19T00:00:00/2025-03-19T23:59:59"
  ],
  "query": [
    "web_events = query_bucket('aw-watcher-web-firefox_nb235988'); not_afk_web = web_events; events_by_url = merge_events_by_keys(not_afk_web, ['url', 'title']); RETURN = sort_by_duration(events_by_url);"
  ]
}

## query for activity categories:
{
  "timeperiods": [
    "2025-03-19T00:00:00/2025-03-19T23:59:59"
  ],
  "query": [
    "# Get base events
window_events = query_bucket('aw-watcher-window_nb235988'); 
afk_events = query_bucket('aw-watcher-afk_nb235988'); 
not_afk = filter_keyvals(afk_events, 'status', ['not-afk']); 
active_events = filter_period_intersect(window_events, not_afk); 

# Programming work (IDEs, dev tools, programming sites)
programming_apps = filter_keyvals(active_events, 'app', [
    'Code.exe',          # VS Code
    'Windsurf.exe',      # Windsurf IDE
    'vim.exe',           # Vim
    'Spyder.exe',        # Python IDE
    'kate.exe',          # Text editor
    'Ghidra.exe',        # Reverse engineering
    'Scite.exe'          # Text editor
]); 
programming_sites = filter_keyvals(active_events, 'title', [
    'GitHub',            # Code hosting
    'Stack Overflow',    # Programming help
    'BitBucket',         # Code hosting
    'Gitlab'             # Code hosting
]);
programming_all = concat(programming_apps, programming_sites);

# Project-specific programming
hisense_work = filter_keyvals(active_events, 'title', [
    'HISENSE',           # Case variations
    'Hisense',
    'hisense',
    'GOHY',
    'GoHy',
    'goHy'
]);
toshl_work = filter_keyvals(active_events, 'title', [
    'TOSHL-MCP-SERVER',
    'Toshl-MCP-Server',
    'toshl-mcp-server'
]);

# DevOps work
devops_apps = filter_keyvals(active_events, 'app', [
    'WindowsTerminal.exe',
    'powershell.exe'
]); 

# Communication & Email
comms_apps = filter_keyvals(active_events, 'app', [
    'OUTLOOK.EXE',       # Email
    'Teams.exe',         # MS Teams
    'Thunderbird.exe',   # Email
    'discord.exe'        # Discord
]); 
comms_sites = filter_keyvals(active_events, 'title', [
    'Gmail',             # Web email
    'bktech',            # Company email
    'reddit',            # Social media
    'Facebook',          # Social media
    'Twitter',           # Social media
    'Instagram',         # Social media
    'devRant',          # Dev social media
    'LinkedIn',          # Professional network
    'discord',           # Chat platform
    'x.com'             # Twitter/X
]);
comms_all = concat(comms_apps, comms_sites);

# Documentation & Writing
docs_apps = filter_keyvals(active_events, 'title', [
    'Tana',              # Note-taking
    'Obsidian',          # Note-taking
    '.docx',             # Word documents
    'dev.azure.com'      # Project management
]); 

# Research & AI tools
research_apps = filter_keyvals(active_events, 'title', [
    'claude',            # AI assistant
    'gemini',            # AI assistant
    'chatgpt',           # AI assistant
    'chat.bostjankamnik.com',  # Personal AI
    'deepseek'           # AI assistant
]); 

# Calculate total duration for each category
programming_time = merge_events_by_keys(programming_all, ['app', 'title']); 
hisense_time = merge_events_by_keys(hisense_work, ['app', 'title']);
toshl_time = merge_events_by_keys(toshl_work, ['app', 'title']);
devops_time = merge_events_by_keys(devops_apps, ['app']); 
comms_time = merge_events_by_keys(comms_all, ['app', 'title']); 
docs_time = merge_events_by_keys(docs_apps, ['title']); 
research_time = merge_events_by_keys(research_apps, ['title']); 

# Return category totals
RETURN = {
    \"Programming\": {
        \"Total\": sum_durations(programming_time),
        \"Hisense\": sum_durations(hisense_time),
        \"Toshl\": sum_durations(toshl_time)
    },
    \"DevOps\": sum_durations(devops_time),
    \"Communication\": sum_durations(comms_time),
    \"Documentation\": sum_durations(docs_time),
    \"Research\": sum_durations(research_time)
};"
  ]
}