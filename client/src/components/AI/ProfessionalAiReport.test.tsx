import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ProfessionalAiReport from './ProfessionalAiReport';

describe('ProfessionalAiReport', () => {
  it('turns fenced JSON into labeled report sections without raw syntax', () => {
    const value = '```json\n{"summary":"Security review complete","risks":[{"finding":"Admin authority requires review","severity":"HIGH"}],"next_actions":["Confirm multisig owners"]}\n```';
    const html = renderToStaticMarkup(<ProfessionalAiReport value={value} />);
    expect(html).toContain('Security review complete');
    expect(html).toContain('Admin authority requires review');
    expect(html).toContain('Confirm multisig owners');
    expect(html).not.toContain('```');
    expect(html).not.toContain('&quot;summary&quot;');
  });

  it('formats prose headings and bullets as readable content', () => {
    const html = renderToStaticMarkup(<ProfessionalAiReport value={'Executive Summary\nReview evidence before release.\n- Confirm owner\n- Record approval'} />);
    expect(html).toContain('Executive Summary');
    expect(html).toContain('Confirm owner');
    expect(html).toContain('<ul');
  });
});
