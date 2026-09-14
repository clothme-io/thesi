// The API verifies current membership; the proxy forwards the identifier only.
export function workspaceHeaders(request: Request): Record<string, string> {
  const value = request.headers.get('x-thesi-workspace-id');
  return value === null ? {} : { 'X-Thesi-Workspace-Id': value };
}
