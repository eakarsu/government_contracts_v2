export const downloadRFPResponse = async (rfpResponseId: number, format: 'txt' | 'pdf' | 'docx') => {
  const response = await fetch(`/api/rfp/responses/${rfpResponseId}/download/${format}`, {
    method: 'GET',
  });

  if (!response.ok) {
    let errorMessage = `Failed to download ${format.toUpperCase()} file (${response.status} ${response.statusText})`;

    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Response might not be JSON
    }

    throw new Error(errorMessage);
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `rfp_response_${rfpResponseId}.${format}`;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  return { success: true, filename };
};

export const getDownloadFormats = () => [
  {
    format: 'txt' as const,
    label: 'Text File',
    description: 'Plain text format (.txt)',
    icon: '📄',
    mimeType: 'text/plain'
  },
  {
    format: 'pdf' as const,
    label: 'PDF Document',
    description: 'Professional PDF format (.pdf)',
    icon: '📋',
    mimeType: 'application/pdf'
  },
  {
    format: 'docx' as const,
    label: 'Word Document',
    description: 'Microsoft Word format (.docx)',
    icon: '📝',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
];

export const saveProposalDraft = async (proposalId: number, title: string, sections: any[]) => {
  const response = await fetch(`/api/ai-rfp/proposals/${proposalId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      sections
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to save draft');
  }

  return await response.json();
};

export const exportProposal = async (proposalId: number, format: 'txt' | 'pdf' | 'docx') => {
  const response = await fetch(`/api/ai-rfp/proposals/${proposalId}/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ format })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Failed to export ${format.toUpperCase()} file`);
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `proposal_${proposalId}.${format}`;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  return { success: true, filename };
};
