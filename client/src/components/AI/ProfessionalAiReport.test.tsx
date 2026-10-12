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

  it('renders JSON strings inside objects and embedded fences without raw syntax', () => {
    const html = renderToStaticMarkup(<ProfessionalAiReport value={{ nested: '```json\n{"id":9842,"next_action":"Review source"}\n```', commentary: 'Before evidence\n```json\n{"embedded_reference":6754}\n```\nAfter evidence' }} />);
    expect(html).toContain('9842'); expect(html).toContain('6754'); expect(html).toContain('Review source'); expect(html).toContain('Before evidence'); expect(html).toContain('After evidence');
    expect(html).not.toContain('```'); expect(html).not.toContain('&quot;next_action&quot;'); expect(html).not.toContain('[object Object]');
  });

  it('preserves false, zero, empty strings, and renders uniform facts as a table', () => {
    const html = renderToStaticMarkup(<ProfessionalAiReport value={{ approved: false, score: 0, note: '', findings: [{ item: 'Clause A', count: 0 }, { item: 'Clause B', count: 2 }] }} />);
    expect(html).toContain('Approved');
    expect(html).toContain('No');
    expect(html).toContain('0');
    expect(html).toContain('Note');
    expect(html).toContain('(empty string)');
    expect(html).toContain('<table');
    expect(html).toContain('Clause A');
  });
});
