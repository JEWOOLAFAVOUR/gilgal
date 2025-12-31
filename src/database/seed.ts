import { query } from './index';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed database with sample data for development and testing
 */

export async function seedDatabase(): Promise<void> {
  console.log('Starting database seeding...');

  try {
    // Clear existing data
    console.log('Clearing existing data...');
    await query('DELETE FROM deployment_logs');
    await query('DELETE FROM deployments');
    await query('DELETE FROM environments');
    await query('DELETE FROM api_keys');
    await query('DELETE FROM projects');
    await query('DELETE FROM users');

    // Create sample users
    console.log('Creating sample users...');
    const user1Id = uuidv4();
    const user2Id = uuidv4();

    const hashedPassword1 = await bcrypt.hash('password123', 10);
    const hashedPassword2 = await bcrypt.hash('password456', 10);

    await query(
      `
      INSERT INTO users (id, email, username, password_hash, full_name, bio)
      VALUES 
        ($1, $2, $3, $4, $5, $6),
        ($7, $8, $9, $10, $11, $12)
      `,
      [
        user1Id,
        'alice@example.com',
        'alice',
        hashedPassword1,
        'Alice Developer',
        'Full-stack developer',
        user2Id,
        'bob@example.com',
        'bob',
        hashedPassword2,
        'Bob Designer',
        'UI/UX designer',
      ]
    );

    // Create sample projects
    console.log('Creating sample projects...');
    const project1Id = uuidv4();
    const project2Id = uuidv4();

    await query(
      `
      INSERT INTO projects (id, user_id, name, slug, description, framework, status)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7),
        ($8, $9, $10, $11, $12, $13, $14)
      `,
      [
        project1Id,
        user1Id,
        'My React App',
        'my-react-app',
        'A beautiful React application',
        'react',
        'active',
        project2Id,
        user2Id,
        'Next.js Portfolio',
        'nextjs-portfolio',
        'Personal portfolio website',
        'next.js',
        'active',
      ]
    );

    // Create sample environments
    console.log('Creating sample environments...');
    const env1Id = uuidv4();
    const env2Id = uuidv4();

    await query(
      `
      INSERT INTO environments (id, project_id, name, type, domain, environment_variables)
      VALUES 
        ($1, $2, $3, $4, $5, $6),
        ($7, $8, $9, $10, $11, $12)
      `,
      [
        env1Id,
        project1Id,
        'Production',
        'production',
        'my-react-app.gilgal.dev',
        JSON.stringify({ API_URL: 'https://api.example.com' }),
        env2Id,
        project2Id,
        'Staging',
        'staging',
        'staging-portfolio.gilgal.dev',
        JSON.stringify({ API_URL: 'https://staging-api.example.com' }),
      ]
    );

    // Create sample deployments
    console.log('Creating sample deployments...');
    await query(
      `
      INSERT INTO deployments (id, project_id, environment_id, commit_sha, commit_message, status, deployed_at)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        uuidv4(),
        project1Id,
        env1Id,
        'abc123def456',
        'Initial deployment',
        'success',
        new Date(),
      ]
    );

    // Create sample API keys
    console.log('Creating sample API keys...');
    const apiKeyHash = await bcrypt.hash('gk_test_' + uuidv4(), 10);
    await query(
      `
      INSERT INTO api_keys (id, user_id, key_hash, name)
      VALUES ($1, $2, $3, $4)
      `,
      [uuidv4(), user1Id, apiKeyHash, 'Development Key']
    );

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
