const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🚀 Setting up ScribeAI...\n')

// Check if .env.local exists
const envPath = path.join(__dirname, '..', '.env.local')
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env.local from template...')
  const envExample = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8')
  fs.writeFileSync(envPath, envExample)
  console.log('✅ Created .env.local - Please update with your actual values\n')
} else {
  console.log('✅ .env.local already exists\n')
}

try {
  console.log('📦 Installing dependencies...')
  execSync('npm install', { stdio: 'inherit' })
  
  console.log('\n📦 Installing server dependencies...')
  execSync('cd server && npm install', { stdio: 'inherit' })
  
  console.log('\n🗄️  Generating Prisma client...')
  execSync('npx prisma generate', { stdio: 'inherit' })
  
  console.log('\n✅ Setup complete!')
  console.log('\n📋 Next steps:')
  console.log('1. Update .env.local with your database URL and API keys')
  console.log('2. Set up your PostgreSQL database')
  console.log('3. Run: npm run db:push')
  console.log('4. Start development: npm run dev (in one terminal)')
  console.log('5. Start server: npm run server (in another terminal)')
  
} catch (error) {
  console.error('❌ Setup failed:', error.message)
  process.exit(1)
}