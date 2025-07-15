'use server';

import { getClient } from '@/lib/redis';
import type { StoredContact } from '@/lib/data';

const STORED_CONTACTS_KEY = 'chatview:stored_contacts';

export async function getStoredContacts(): Promise<StoredContact[]> {
  try {
    const client = await getClient();
    const contactsJson = await client.get(STORED_CONTACTS_KEY);
    return contactsJson ? JSON.parse(contactsJson) : [];
  } catch (error) {
    console.error('Falha ao buscar contatos armazenados do Redis:', error);
    return [];
  }
}

export async function saveStoredContacts(contacts: StoredContact[]): Promise<void> {
  try {
    const client = await getClient();
    await client.set(STORED_CONTACTS_KEY, JSON.stringify(contacts));
  } catch (error) {
    console.error('Falha ao salvar contatos no Redis:', error);
    throw error;
  }
}

function cleanPhoneNumber(phone: string): string {
    // Remove non-digit characters and standardize format
    return phone.replace(/\D/g, '');
}

// Manual VCF parser to be more resilient
function manualVcfParser(vcfContent: string): StoredContact[] {
  const contacts: StoredContact[] = [];
  const cards = vcfContent.split('BEGIN:VCARD');

  for (const card of cards) {
    if (!card.trim()) continue;

    const lines = card.split('\n');
    let name: string | null = null;
    let phone: string | null = null;

    for (const line of lines) {
      if (line.startsWith('FN:')) {
        name = line.substring(3).trim();
      } else if (line.startsWith('TEL')) {
        // Find the phone number, which is after the colon
        const parts = line.split(':');
        if (parts.length > 1) {
            phone = parts[1].trim();
        }
      }
    }
    
    if (name && phone) {
      const cleanedPhone = cleanPhoneNumber(phone);
      if (cleanedPhone) {
          const id = `${cleanedPhone}@c.us`;
          contacts.push({ name, id });
      }
    }
  }
  return contacts;
}


export async function processVcfFile(vcfContent: string): Promise<StoredContact[]> {
  try {
    // Use the new manual parser
    const contacts = manualVcfParser(vcfContent);

    if (contacts.length === 0) {
      throw new Error("No valid contacts found in the VCF file.");
    }

    // Remove duplicates based on ID
    const uniqueContacts = Array.from(new Map(contacts.map(item => [item.id, item])).values());

    return uniqueContacts;

  } catch (error) {
    console.error('Error parsing VCF file:', error);
    throw new Error('Failed to parse VCF file. Please check the file format and try again.');
  }
}

