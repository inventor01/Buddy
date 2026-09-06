import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// GitHub agent action — lets a buddy perform GitHub tasks on behalf of
// the user. Requires GITHUB_TOKEN in app secrets (a personal access token
// with the appropriate scopes for the actions below).
//
// Supported actions (sent via body.action):
//   search_repos   — search GitHub repositories
//   list_issues    — list open issues for a repo
//   create_issue   — create a new issue
//   get_repo       — fetch repo metadata
//   list_prs       — list open pull requests
//   get_file       — read a file from a repo
//
// The function is intentionally read-heavy by default; write actions
// (create_issue) require the token to have `repo` scope.

const GH = 'https://api.github.com';

async function gh(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(GH + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`GitHub ${res.status}: ${err}`);
  }
  return res.json();
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Legacy maintenance endpoint: it uses one app-wide GitHub credential.
    // Never expose that credential's repositories/actions to ordinary users.
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const token = secrets.get('GITHUB_TOKEN');
    if (!token) {
      return Response.json(
        { error: 'GitHub is not connected. Ask the app owner to add a GITHUB_TOKEN secret.' },
        { status: 503 }
      );
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const action = typeof body.action === 'string' ? body.action.trim() : '';
    if (!action) {
      return Response.json({ error: 'action is required' }, { status: 400 });
    }

    switch (action) {
      case 'search_repos': {
        const q = typeof body.query === 'string' ? body.query.trim() : '';
        if (!q) return Response.json({ error: 'query is required for search_repos' }, { status: 400 });
        const data = await gh(`/search/repositories?q=${encodeURIComponent(q)}&per_page=10`, token);
        return Response.json({
          repos: (data.items || []).map((r: any) => ({
            full_name: r.full_name,
            description: r.description,
            stars: r.stargazers_count,
            url: r.html_url,
            language: r.language,
          })),
          total: data.total_count,
        });
      }

      case 'get_repo': {
        const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
        if (!repo) return Response.json({ error: 'repo (owner/name) is required' }, { status: 400 });
        const data = await gh(`/repos/${repo}`, token);
        return Response.json({
          full_name: data.full_name,
          description: data.description,
          stars: data.stargazers_count,
          forks: data.forks_count,
          open_issues: data.open_issues_count,
          default_branch: data.default_branch,
          url: data.html_url,
          language: data.language,
          topics: data.topics,
          updated_at: data.updated_at,
        });
      }

      case 'list_issues': {
        const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
        if (!repo) return Response.json({ error: 'repo (owner/name) is required' }, { status: 400 });
        const state = body.state === 'closed' ? 'closed' : 'open';
        const data = await gh(`/repos/${repo}/issues?state=${state}&per_page=20`, token);
        return Response.json({
          issues: (data as any[]).filter((i: any) => !i.pull_request).map((i: any) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            url: i.html_url,
            created_at: i.created_at,
            labels: (i.labels || []).map((l: any) => l.name),
          })),
        });
      }

      case 'create_issue': {
        const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const issueBody = typeof body.body === 'string' ? body.body.trim() : '';
        if (!repo || !title) {
          return Response.json({ error: 'repo and title are required for create_issue' }, { status: 400 });
        }
        const data = await gh(`/repos/${repo}/issues`, token, {
          method: 'POST',
          body: JSON.stringify({ title, body: issueBody }),
        });
        return Response.json({ number: data.number, url: data.html_url, title: data.title });
      }

      case 'list_prs': {
        const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
        if (!repo) return Response.json({ error: 'repo (owner/name) is required' }, { status: 400 });
        const state = body.state === 'closed' ? 'closed' : 'open';
        const data = await gh(`/repos/${repo}/pulls?state=${state}&per_page=20`, token);
        return Response.json({
          prs: (data as any[]).map((p: any) => ({
            number: p.number,
            title: p.title,
            state: p.state,
            url: p.html_url,
            created_at: p.created_at,
            head: p.head?.ref,
            base: p.base?.ref,
          })),
        });
      }

      case 'get_file': {
        const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
        const filePath = typeof body.path === 'string' ? body.path.trim() : '';
        const ref = typeof body.ref === 'string' ? body.ref.trim() : '';
        if (!repo || !filePath) {
          return Response.json({ error: 'repo and path are required for get_file' }, { status: 400 });
        }
        const url = `/repos/${repo}/contents/${filePath}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
        const data = await gh(url, token);
        // Decode base64 content (GitHub returns base64-encoded file bodies)
        const content = typeof data.content === 'string'
          ? atob(data.content.replace(/\n/g, ''))
          : null;
        return Response.json({
          path: data.path,
          size: data.size,
          sha: data.sha,
          url: data.html_url,
          // Cap content at 20 KB to stay within response limits
          content: content ? content.slice(0, 20_000) : null,
          truncated: content ? content.length > 20_000 : false,
        });
      }

      default:
        return Response.json(
          { error: `Unknown action "${action}". Supported: search_repos, get_repo, list_issues, create_issue, list_prs, get_file` },
          { status: 400 }
        );
    }
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
