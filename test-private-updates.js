#!/usr/bin/env node

/**
 * Script de test pour les mises à jour OTA avec repository privé
 * Utilisation: node test-private-updates.js
 */

require('dotenv').config();
const fs = require('fs');
const https = require('https');

console.log('🔐 Test des mises à jour OTA - Repository Privé\n');

// Vérification du token GitHub
console.log('🔑 Vérification du token GitHub...');
const token = process.env.GH_TOKEN;

if (!token) {
    console.log('❌ Token GitHub non configuré');
    console.log('💡 Créez un fichier .env avec :');
    console.log('   GH_TOKEN=ghp_votre_token_ici');
    console.log('');
    console.log('📖 Consultez private-repo-setup.md pour les instructions complètes');
    process.exit(1);
}

console.log('✅ Token GitHub configuré');
console.log(`🔗 Token: ${token.substring(0, 10)}...${token.substring(token.length - 4)}`);

// Test de connexion au repository
console.log('\n🌐 Test de connexion au repository...');
const repoUrl = 'https://api.github.com/repos/Hassan-JERRAR/Tiktok_live_manager';

const options = {
    hostname: 'api.github.com',
    path: '/repos/Hassan-JERRAR/Tiktok_live_manager',
    method: 'GET',
    headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'TikTok-Live-Manager-Updater',
        'Accept': 'application/vnd.github.v3+json'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        if (res.statusCode === 200) {
            const repo = JSON.parse(data);
            console.log('✅ Connexion au repository réussie');
            console.log(`📦 Repository: ${repo.full_name}`);
            console.log(`🔒 Privé: ${repo.private ? 'Oui' : 'Non'}`);
            console.log(`📝 Description: ${repo.description}`);
            
            // Test des releases
            testReleases(token);
        } else if (res.statusCode === 401) {
            console.log('❌ Erreur d\'authentification (401)');
            console.log('💡 Vérifiez que votre token a les permissions "repo"');
        } else if (res.statusCode === 404) {
            console.log('❌ Repository non trouvé (404)');
            console.log('💡 Vérifiez le nom du repository dans la configuration');
        } else {
            console.log(`❌ Erreur HTTP ${res.statusCode}`);
            console.log('📄 Réponse:', data);
        }
    });
});

req.on('error', (error) => {
    console.log('❌ Erreur de connexion:', error.message);
    console.log('🌐 Vérifiez votre connexion internet');
});

req.end();

// Test des releases
function testReleases(token) {
    console.log('\n📋 Test des releases...');
    
    const releaseOptions = {
        hostname: 'api.github.com',
        path: '/repos/Hassan-JERRAR/Tiktok_live_manager/releases',
        method: 'GET',
        headers: {
            'Authorization': `token ${token}`,
            'User-Agent': 'TikTok-Live-Manager-Updater',
            'Accept': 'application/vnd.github.v3+json'
        }
    };
    
    const releaseReq = https.request(releaseOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            if (res.statusCode === 200) {
                const releases = JSON.parse(data);
                console.log(`✅ ${releases.length} release(s) trouvée(s)`);
                
                if (releases.length > 0) {
                    const latest = releases[0];
                    console.log(`📦 Dernière release: ${latest.tag_name}`);
                    console.log(`📅 Publiée le: ${new Date(latest.published_at).toLocaleDateString()}`);
                    console.log(`💾 ${latest.assets.length} asset(s) disponible(s)`);
                    
                    if (latest.assets.length > 0) {
                        console.log('📎 Assets:');
                        latest.assets.forEach(asset => {
                            const sizeMB = (asset.size / 1024 / 1024).toFixed(1);
                            console.log(`   - ${asset.name} (${sizeMB}MB)`);
                        });
                    }
                } else {
                    console.log('⚠️  Aucune release trouvée');
                    console.log('💡 Créez votre première release avec: npm version patch && git push origin --tags');
                }
                
                // Instructions finales
                showFinalInstructions();
            } else {
                console.log(`❌ Erreur lors de la récupération des releases: ${res.statusCode}`);
            }
        });
    });
    
    releaseReq.on('error', (error) => {
        console.log('❌ Erreur:', error.message);
    });
    
    releaseReq.end();
}

function showFinalInstructions() {
    console.log('\n✨ Configuration validée avec succès !');
    console.log('\n🚀 Prochaines étapes:');
    console.log('1. Créez votre première release:');
    console.log('   npm version patch');
    console.log('   git push origin --tags');
    console.log('');
    console.log('2. Configurez GitHub Actions:');
    console.log('   - Allez sur GitHub > Settings > Secrets');
    console.log('   - Ajoutez GITHUB_PERSONAL_TOKEN avec votre token');
    console.log('');
    console.log('3. Testez les mises à jour:');
    console.log('   npm run dev');
    console.log('   - Ouvrez l\'onglet Paramètres');
    console.log('   - Cliquez "Vérifier les mises à jour"');
    console.log('');
    console.log('📖 Documentation complète: private-repo-setup.md');
}