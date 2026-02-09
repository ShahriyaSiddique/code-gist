import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  getProfile: jest.fn(),
};

const mockUser: User = {
  id: 'user-1',
  name: 'Test',
  email: 'test@example.com',
  passwordHash: 'hash',
  snippets: [],
  createdAt: new Date(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should call authService.register with body', async () => {
      const dto: RegisterDto = { email: 'a@b.com', password: 'password123', name: 'User' };
      mockAuthService.register.mockResolvedValue({ user: {}, accessToken: 'token' });
      await controller.register(dto);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should call authService.login with body', async () => {
      const dto: LoginDto = { email: 'a@b.com', password: 'pass' };
      mockAuthService.login.mockResolvedValue({ user: {}, accessToken: 'token' });
      await controller.login(dto);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('getProfile', () => {
    it('should return profile from req.user', async () => {
      mockAuthService.getProfile.mockReturnValue({ id: mockUser.id, name: mockUser.name, email: mockUser.email });
      const req = { user: mockUser };
      const result = await controller.getProfile(req);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({ id: mockUser.id, name: mockUser.name, email: mockUser.email });
    });
  });
});
