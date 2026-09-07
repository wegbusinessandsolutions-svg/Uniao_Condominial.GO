import sys

with open('src/context/CartContext.tsx', 'r') as f:
    content = f.read()

target = """        // Fetch current Firestore items
        const q = query(cartRef);
        const snapshot = await getDocs(q);
        const firestoreItems: CartItem[] = [];
        snapshot.forEach((docSnap) => {
          firestoreItems.push(docSnap.data() as CartItem);
        });

        // Check if we have guest items to merge"""

replacement = """        // Fetch current Firestore items
        const q = query(cartRef);
        const snapshot = await getDocs(q);
        let firestoreItems: CartItem[] = [];
        
        let newestUpdate = 0;
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          firestoreItems.push(data as CartItem);
          if (data.updatedAt) {
            const time = new Date(data.updatedAt).getTime();
            if (time > newestUpdate) newestUpdate = time;
          }
        });

        // Check for 7 days expiration (7 * 24 * 60 * 60 * 1000 = 604800000 ms)
        const SEVEN_DAYS = 604800000;
        if (newestUpdate > 0 && Date.now() - newestUpdate > SEVEN_DAYS) {
          // Expire cart
          const batchDeletes = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
          await Promise.all(batchDeletes);
          firestoreItems = [];
        }

        // Check if we have guest items to merge"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/context/CartContext.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Target not found")
