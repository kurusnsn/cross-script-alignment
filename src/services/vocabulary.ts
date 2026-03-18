import { API_BASE_URL } from '@/config';

export interface VocabularyItem {
  id: number;
  word: string;
  aligneration: string;
  translation: string;
  ipa?: string;
  pos?: string;
  context?: string;
}

export const saveVocabularyItem = async (
  item: Omit<VocabularyItem, 'id'>,
  token: string
): Promise<VocabularyItem> => {
  const response = await fetch(`${API_BASE_URL}/vocabulary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    throw new Error('Failed to save vocabulary item');
  }

  return response.json();
};

export const getVocabularyItems = async (token: string): Promise<VocabularyItem[]> => {
  const response = await fetch(`${API_BASE_URL}/vocabulary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch vocabulary items');
  }

  return response.json();
};

export const deleteVocabularyItem = async (id: number, token: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/vocabulary/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete vocabulary item');
  }
};
