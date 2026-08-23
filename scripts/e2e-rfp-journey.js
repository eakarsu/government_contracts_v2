'use strict';

const puppeteer = require('puppeteer');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  if (process.env.E2E_ALLOW_MUTATION !== 'RUN_ISOLATED_RFP_E2E') throw new Error('E2E_ALLOW_MUTATION must equal RUN_ISOLATED_RFP_E2E');
  if (!/(?:^|[_-])test(?:$|[_-])/i.test(required('E2E_DATABASE_NAME'))) throw new Error('E2E_DATABASE_NAME must explicitly identify a test database');
  const baseUrl = required('E2E_BASE_URL').replace(/\/$/, '');
  const parsed = new URL(baseUrl);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('The mutating browser journey may run only against localhost');
  const email = required('E2E_ADMIN_EMAIL'); const password = required('E2E_ADMIN_PASSWORD');

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/rfp`, { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="rfp-opportunity"]');

    for (const selector of ['[data-testid="rfp-opportunity"]', '[data-testid="rfp-profile"]', '[data-testid="rfp-template"]']) {
      const values = await page.$$eval(`${selector} option`, options => options.map(option => option.value).filter(Boolean));
      if (!values.length) throw new Error(`The isolated E2E database needs a seeded option for ${selector}`);
      await page.select(selector, values[0]);
    }
    await page.click('[data-testid="rfp-analyze"]');
    await page.waitForFunction(() => document.body.innerText.includes('Win probability'), { timeout: 120000 });
    await page.click('[data-testid="rfp-generate"]');
    await page.waitForFunction(() => document.body.innerText.includes('Submission package checklist'), { timeout: 1200000 });

    const result = await page.evaluate(async reviewerEmail => {
      const token = localStorage.getItem('auth_token');
      const request = async (path, init = {}) => {
        const response = await fetch(`/api${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
        const body = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.blob();
        if (!response.ok) throw new Error(`${path}: ${body.error || response.status}`);
        return body;
      };
      const selectedContract = document.querySelector('[data-testid="rfp-opportunity"]').value;
      const responses = await request('/rfp/responses?page=1&limit=100');
      const proposal = responses.responses.find(item => item.contractId === selectedContract);
      if (!proposal) throw new Error('Generated proposal was not returned');
      const id = proposal.id;
      const requirements = await request(`/rfp/responses/${id}/requirements/sync`, { method: 'POST' });
      for (const requirement of requirements.requirements) {
        await request(`/rfp/responses/${id}/requirements/${requirement.id}`, { method: 'PUT', body: JSON.stringify({ coverageStatus: 'COVERED', reviewStatus: 'VERIFIED' }) });
      }
      await request(`/rfp/responses/${id}/versions`, { method: 'POST', body: JSON.stringify({ comment: 'E2E governed checkpoint' }) });
      await request(`/rfp/responses/${id}/comments`, { method: 'POST', body: JSON.stringify({ body: 'E2E reviewer comment' }) });
      await request(`/rfp/responses/${id}/collaborators`, { method: 'POST', body: JSON.stringify({ email: reviewerEmail, role: 'approver' }) });
      for (const gate of ['CONTENT', 'COMPLIANCE', 'EXECUTIVE', 'SUBMISSION']) {
        const assigned = await request(`/rfp/responses/${id}/approvals`, { method: 'POST', body: JSON.stringify({ gate, reviewerEmail }) });
        await request(`/rfp/responses/${id}/approvals/${assigned.approval.id}/decision`, { method: 'POST', body: JSON.stringify({ decision: 'APPROVED', rationale: 'E2E isolated approval validation' }) });
      }
      let workspace = await request(`/rfp/responses/${id}/workspace`);
      for (const item of workspace.workspace.checklistItems) {
        await request(`/rfp/responses/${id}/checklist/${item.id}`, { method: 'PUT', body: JSON.stringify({ completed: true }) });
      }
      await request(`/rfp/responses/${id}/submission`, { method: 'POST', body: JSON.stringify({ destination: 'https://sam.gov/e2e-isolated', submissionMethod: 'E2E simulation', trackingNumber: 'E2E-RECEIPT' }) });
      await request(`/rfp/responses/${id}/outcome`, { method: 'PUT', body: JSON.stringify({ outcome: 'LOST', debrief: 'Isolated end-to-end validation record' }) });
      const download = await fetch(`/api/rfp/responses/${id}/download/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!download.ok || !download.headers.get('content-type')?.includes('pdf')) throw new Error('Proposal package PDF download failed');
      workspace = await request(`/rfp/responses/${id}/workspace`);
      return { id, submission: workspace.workspace.submission.status, outcome: workspace.workspace.outcome.outcome, auditEvents: workspace.workspace.auditEvents.length };
    }, email);
    console.log(JSON.stringify({ success: true, ...result }));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
