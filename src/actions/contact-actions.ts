'use server';

import { getClient } from '@/lib/redis';
import type { StoredContact } from '@/lib/data';
import vCard from 'vcard-parser';

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

export async function processVcfFile(vcfContent: string): Promise<StoredContact[]> {
  try {
    const parsedCards = vCard.parse(vcfContent);
    
    const contacts: StoredContact[] = parsedCards.map(card => {
        const name = card.fn?.[0]?.value || 'Nome não encontrado';
        
        let phone = '';
        if (card.tel && card.tel.length > 0) {
            // Prioritize cellular phone numbers if available
            const cell = card.tel.find(t => t.meta?.type?.includes('cell'));
            phone = cell?.value || card.tel[0].value;
        }

        const cleanedPhone = cleanPhoneNumber(phone);
        
        // Format to WhatsApp JID format
        const id = `${cleanedPhone}@c.us`;

        return { name, id };
    }).filter(contact => contact.name && contact.id.length > 5); // Basic validation

    // Remove duplicates based on ID
    const uniqueContacts = Array.from(new Map(contacts.map(item => [item.id, item])).values());

    return uniqueContacts;

  } catch (error) {
    console.error('Error parsing VCF file:', error);
    throw new Error('Failed to parse VCF file. Please check the file format and try again.');
  }
}
