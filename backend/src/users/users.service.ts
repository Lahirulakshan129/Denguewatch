import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from './user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.seedUser(
      this.config.get('seed.adminEmail'),
      this.config.get('seed.adminPassword'),
      UserRole.ADMIN,
    );
    await this.seedUser(
      this.config.get('seed.officerEmail'),
      this.config.get('seed.officerPassword'),
      UserRole.OFFICER,
    );
  }

  async seedUser(email: string, pass: string, role: UserRole) {
    const existing = await this.usersRepository.findOneBy({ email });
    if (!existing) {
      const passwordHash = await bcrypt.hash(pass, 10);
      const user = this.usersRepository.create({ email, passwordHash, role });
      await this.usersRepository.save(user);
      console.log(`Seeded ${role}: ${email}`);
    }
  }

  async findOne(email: string): Promise<User | undefined> {
    return this.usersRepository.findOneBy({ email });
  }
}
