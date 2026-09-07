import sys

with open('src/pages/cliente/Afiliacao.tsx', 'r') as f:
    content = f.read()

target = 'import { doc, setDoc, addDoc, serverTimestamp, collection, onSnapshot, query, where, getDocs, getDoc } from "firebase/firestore";'
replacement = 'import { doc, setDoc, addDoc, serverTimestamp, collection, onSnapshot, query, where, getDocs, getDoc } from "firebase/firestore";'

# Let's just check if it's there
if "addDoc" in content and "collection" in content and "query" in content and "where" in content and "getDocs" in content:
    print("All imports present")
else:
    print("Missing imports")
