read -p "Enter commit message: " msg

cp ../v3.js src/engine.js
git add .
git commit -m "$msg"
