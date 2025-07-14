// Download helper functions for RFP responses

export const downloadRFPResponse = async (rfpResponseId: number, format: 'txt' | 'pdf' | 'docx') => {
  try {
    console.log(`📄 [DEBUG] Downloading RFP response ${rfpResponseId} as ${format.toUpperCase()}`);
    
    const response = await fetch(`/api/rfp/responses/${rfpResponseId}/download/${format}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to download ${format.toUpperCase()} file`);
    }

    // Get the filename from the Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `rfp_response_${rfpResponseId}.${format}`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log(`✅ [DEBUG] Successfully downloaded ${filename}`);
    return { success: true, filename };
  } catch (error) {
    console.error(`❌ [DEBUG] Error downloading ${format.toUpperCase()}:`, error);
    throw error;
  }
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

// AI RFP Proposal helper functions
export const saveProposalDraft = async (proposalId: number, title: string, sections: any[]) => {
  try {
    console.log(`💾 [DEBUG] Saving draft for proposal ${proposalId}`);
    
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

    const result = await response.json();
    console.log(`✅ [DEBUG] Draft saved successfully`);
    
    return result;
  } catch (error) {
    console.error(`❌ [DEBUG] Error saving draft:`, error);
    throw error;
  }
};

export const exportProposal = async (proposalId: number, format: 'txt' | 'pdf' | 'docx') => {
  try {
    console.log(`📄 [DEBUG] Exporting proposal ${proposalId} as ${format.toUpperCase()}`);
    
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

    // Get the filename from the Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `proposal_${proposalId}.${format}`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log(`✅ [DEBUG] Successfully exported ${filename}`);
    return { success: true, filename };
  } catch (error) {
    console.error(`❌ [DEBUG] Error exporting ${format.toUpperCase()}:`, error);
    throw error;
  }
};

