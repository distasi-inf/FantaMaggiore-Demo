import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    // Rimuoviamo l'inject di AuthService e l'header Authorization.
    // In questo modo Supabase tratterà le richieste come veramente anonime
    // e applicherà le policy 'anon' senza cercare firme JWT.
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  async uploadPlayerImage(file: File, userId: number): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `players/${userId}_${Date.now()}.${ext}`;

    const { error } = await this.supabase.storage
      .from('player-images')
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data } = this.supabase.storage.from('player-images').getPublicUrl(path);

    return data.publicUrl;
  }

  async deleteImageByUrl(publicUrl: string): Promise<void> {
    if (!publicUrl || !publicUrl.includes('supabase.co')) return;
    try {
      const pathPart = publicUrl.split('player-images/').pop();
      if (pathPart) {
        await this.supabase.storage.from('player-images').remove([pathPart]);
      }
    } catch (e) {
      console.error('Errore rimozione file:', e);
    }
  }
}
