
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
    // Garante que não há duplicatas antes de salvar
    const uniqueContacts = Array.from(new Map(contacts.map(item => [item.id, item])).values());
    await client.set(STORED_CONTACTS_KEY, JSON.stringify(uniqueContacts));
  } catch (error) {
    console.error('Falha ao salvar contatos no Redis:', error);
    throw error;
  }
}

function cleanPhoneNumber(phone: string): string {
    // Remove non-digit characters to get the base number
    return phone.split('@')[0].replace(/\D/g, '');
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
        const parts = line.split(':');
        if (parts.length > 1) {
            phone = parts[1].trim();
        }
      }
    }
    
    if (name && phone) {
      const basePhone = cleanPhoneNumber(phone);
      if (basePhone) {
          // Padroniza o ID para o formato correto
          const id = `${basePhone}@s.whatsapp.net`;
          contacts.push({ name, id });
      }
    }
  }
  return contacts;
}

export async function processVcfAndUpdateContacts(vcfContent: string): Promise<{updated: number, added: number}> {
  try {
    const newContacts = manualVcfParser(vcfContent);
    if (newContacts.length === 0) {
      throw new Error("No valid contacts found in the VCF file.");
    }
    
    const existingContacts = await getStoredContacts();
    const existingContactsMap = new Map(existingContacts.map(c => [c.id.split('@')[0], c]));

    let updatedCount = 0;
    let addedCount = 0;

    for (const newContact of newContacts) {
        const baseId = newContact.id.split('@')[0];
        
        // Corrige IDs de @c.us para @s.whatsapp.net
        const oldCusId = `${baseId}@c.us`;

        if (existingContactsMap.has(baseId)) {
            const existing = existingContactsMap.get(baseId)!;
            // Atualiza o nome se for diferente
            if(existing.name !== newContact.name || existing.id !== newContact.id) {
                existing.name = newContact.name;
                existing.id = newContact.id; // Garante que o ID está no formato correto
                updatedCount++;
            }
        } else if (existingContactsMap.has(oldCusId.split('@')[0])) {
             const existing = existingContactsMap.get(oldCusId.split('@')[0])!;
             if(existing.name !== newContact.name || existing.id !== newContact.id) {
                existing.name = newContact.name;
                existing.id = newContact.id;
                updatedCount++;
            }
        } else {
            existingContactsMap.set(baseId, newContact);
            addedCount++;
        }
    }

    const updatedContactList = Array.from(existingContactsMap.values());
    await saveStoredContacts(updatedContactList);

    return { updated: updatedCount, added: addedCount };

  } catch (error) {
    console.error('Error processing VCF file:', error);
    throw new Error('Failed to parse VCF file. Please check the file format and try again.');
  }
}
