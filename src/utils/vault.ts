export const TimetableVault = {
  async saveImage(base64: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BunkmateVault', 1);
      
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images');
        }
      };
      
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction('images', 'readwrite');
        const store = tx.objectStore('images');
        store.put(base64, 'timetable_image');
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  },

  async getImage(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BunkmateVault', 1);
      
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images');
        }
      };
      
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('images')) {
          resolve(null);
          return;
        }
        
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const getReq = store.get('timetable_image');
        
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => reject(getReq.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
};
