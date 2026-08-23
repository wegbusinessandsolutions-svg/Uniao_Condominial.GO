#!/bin/bash

# Update Home.tsx
sed -i 's/const \[isSuggestionModalOpen, setIsSuggestionModalOpen\] = useState(false);/const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);\n  const [isSuggestionSuccess, setIsSuggestionSuccess] = useState(false);/g' src/pages/shop/Home.tsx

# Update Dashboard.tsx
sed -i 's/const \[isSuggestionModalOpen, setIsSuggestionModalOpen\] = useState(false);/const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);\n  const [isSuggestionSuccess, setIsSuggestionSuccess] = useState(false);/g' src/pages/cliente/Dashboard.tsx
