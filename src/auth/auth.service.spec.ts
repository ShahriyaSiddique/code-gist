import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockUser: User = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: '$2b$10$hashed',
  snippets: [],
  createdAt: new Date(),
};

const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('fake-jwt-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      const result = await service.validateUser('user-1');
      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should return undefined when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const result = await service.validateUser('missing');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return user and accessToken for valid credentials', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loginDto: LoginDto = { email: 'test@example.com', password: 'password123' };
      const result = await service.login(loginDto);

      expect(result).toEqual({
        user: { id: mockUser.id, name: mockUser.name, email: mockUser.email },
        accessToken: 'fake-jwt-token',
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.passwordHash);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ email: mockUser.email, sub: mockUser.id });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const loginDto: LoginDto = { email: 'unknown@example.com', password: 'password123' };
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const loginDto: LoginDto = { email: 'test@example.com', password: 'wrong' };
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create user and return user + accessToken', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      const savedUser = { ...mockUser, passwordHash: 'hashed-password' };
      mockRepository.create.mockReturnValue(savedUser);
      mockRepository.save.mockResolvedValue(savedUser);

      const registerDto: RegisterDto = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      };
      const result = await service.register(registerDto);

      expect(result).toEqual({
        user: { id: savedUser.id, name: savedUser.name, email: savedUser.email },
        accessToken: 'fake-jwt-token',
      });
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New User', email: 'new@example.com' }),
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
      };
      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('Email already exists');
    });
  });

  describe('getProfile', () => {
    it('should return user response without password', () => {
      const result = service.getProfile(mockUser);
      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
      });
    });
  });
});
