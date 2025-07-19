#!/usr/bin/env node

/**
 * Script de test pour le système de mise à jour OTA
 * Utilisation: node test-update.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Test du système de mise à jour OTA\n');

// Vérification des dépendances
console.log('📦 Vérification des dépendances...');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    if (!packageJson.dependencies['electron-updater']) {
        console.error('❌ electron-updater n\'est pas installé');
        process.exit(1);
    }
    
    console.log('✅ electron-updater installé');
    console.log(`📋 Version actuelle: ${packageJson.version}`);
} catch (error) {
    console.error('❌ Erreur lors de la lecture de package.json:', error.message);
    process.exit(1);
}

// Vérification des fichiers requis
console.log('\n📂 Vérification des fichiers...');
const requiredFiles = [
    'src/modules/updater/update-manager.js',
    '.github/workflows/release.yml',
    'update-instructions.md'
];

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} manquant`);
    }
});

// Vérification de la configuration
console.log('\n⚙️  Vérification de la configuration...');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Vérifier la configuration publish
    if (packageJson.build && packageJson.build.publish) {
        const publish = packageJson.build.publish;
        console.log(`✅ Provider: ${publish.provider}`);
        console.log(`📁 Repository: ${publish.owner}/${publish.repo}`);
        
        if (publish.owner === 'your-github-username') {
            console.log('⚠️  ATTENTION: Vous devez modifier "owner" dans package.json');
        }
    } else {
        console.log('❌ Configuration "publish" manquante dans package.json');
    }
    
    // Vérifier les scripts
    if (packageJson.scripts['build-publish']) {
        console.log('✅ Script build-publish configuré');
    } else {
        console.log('❌ Script build-publish manquant');
    }
    
} catch (error) {
    console.error('❌ Erreur lors de la vérification de la configuration:', error.message);
}

// Test de build
console.log('\n🔨 Test de build...');
try {
    console.log('Building application...');
    execSync('npm run build', { stdio: 'pipe' });
    console.log('✅ Build réussi');
    
    // Vérifier que le dossier dist existe
    if (fs.existsSync('dist')) {
        const distFiles = fs.readdirSync('dist');
        console.log(`📦 ${distFiles.length} fichier(s) dans dist/`);
        
        // Lister quelques fichiers importants
        const importantFiles = distFiles.filter(file => 
            file.includes('.exe') || 
            file.includes('.dmg') || 
            file.includes('.AppImage') ||
            file.includes('.yml')
        );
        
        if (importantFiles.length > 0) {
            console.log('📋 Fichiers générés:');
            importantFiles.forEach(file => console.log(`   - ${file}`));
        }
    }
} catch (error) {
    console.log('❌ Erreur lors du build:', error.message);
    console.log('💡 Assurez-vous que toutes les dépendances sont installées');
}

// Instructions finales
console.log('\n📚 Prochaines étapes:');
console.log('1. Modifier "owner" dans package.json avec votre nom d\'utilisateur GitHub');
console.log('2. Créer un repository GitHub et pousser le code');
console.log('3. Configurer les GitHub Actions');
console.log('4. Créer votre première release avec: npm version patch && git push origin --tags');
console.log('5. Tester les mises à jour avec l\'interface utilisateur');

console.log('\n✨ Système de mise à jour OTA configuré!');
console.log('📖 Voir update-instructions.md pour plus de détails');

console.log('\n🚀 Pour tester maintenant:');
console.log('   npm start  # Lance l\'application');
console.log('   npm run dev  # Lance en mode développement');