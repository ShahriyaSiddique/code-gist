import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SnippetsService } from './snippets.service';
import { Snippets } from './entities/snippets.entity';
import { SnippetShare } from './entities/snippet-share.entity';
import { User } from '../users/entities/user.entity';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';
import { ShareSnippetDto } from './dto/share-snippet.dto';

const mockUser: User = {
  id: 'owner-id',
  name: 'Owner',
  email: 'owner@example.com',
  passwordHash: 'hash',
  snippets: [],
  createdAt: new Date(),
};

const mockOtherUser: User = {
  id: 'other-id',
  name: 'Other',
  email: 'other@example.com',
  passwordHash: 'hash',
  snippets: [],
  createdAt: new Date(),
};

const mockSnippet: Snippets = {
  id: 'snippet-1',
  title: 'My Snippet',
  code: 'const x = 1;',
  language: 'javascript',
  isPublic: false,
  user: mockUser,
  shares: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createQueryBuilder = () => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
});

describe('SnippetsService', () => {
  let service: SnippetsService;
  let snippetRepo: any;
  let snippetShareRepo: any;
  let userRepo: any;

  beforeEach(async () => {
    const qb = createQueryBuilder();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnippetsService,
        {
          provide: getRepositoryToken(Snippets),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(qb),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(SnippetShare),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn().mockResolvedValue({ affected: 0 }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SnippetsService>(SnippetsService);
    snippetRepo = module.get(getRepositoryToken(Snippets));
    snippetShareRepo = module.get(getRepositoryToken(SnippetShare));
    userRepo = module.get(getRepositoryToken(User));
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call queryBuilder with userId when provided', async () => {
      const qb = snippetRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([mockSnippet]);
      const result = await service.findAll('user-1');
      expect(qb.where).toHaveBeenCalledWith(
        '(snippet.isPublic = :isPublic OR snippet.user.id = :userId)',
        { isPublic: true, userId: 'user-1' },
      );
      expect(result).toEqual([mockSnippet]);
    });

    it('should filter only public when no userId', async () => {
      const qb = snippetRepo.createQueryBuilder();
      await service.findAll();
      expect(qb.where).toHaveBeenCalledWith('snippet.isPublic = :isPublic', { isPublic: true });
    });
  });

  describe('create', () => {
    it('should create and save snippet', async () => {
      const dto: CreateSnippetDto = {
        title: 'New',
        code: 'code',
        language: 'javascript',
        isPublic: false,
      };
      const created = { ...mockSnippet, ...dto, user: mockUser };
      snippetRepo.create.mockReturnValue(created);
      snippetRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, mockUser);
      expect(snippetRepo.create).toHaveBeenCalledWith({ ...dto, user: mockUser });
      expect(result).toEqual({ id: created.id });
    });
  });

  describe('findOne', () => {
    it('should return snippet when found and user has access', async () => {
      snippetRepo.findOne.mockResolvedValue({ ...mockSnippet, isPublic: true });
      const result = await service.findOne('snippet-1', 'any-user');
      expect(result).toEqual(expect.objectContaining({ id: 'snippet-1' }));
    });

    it('should throw NotFoundException when snippet not found', async () => {
      snippetRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing', 'user-1')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('missing', 'user-1')).rejects.toThrow('Snippet not found');
    });

    it('should throw ForbiddenException when user has no access', async () => {
      snippetRepo.findOne.mockResolvedValue({ ...mockSnippet, isPublic: false, user: mockUser, shares: [] });
      await expect(service.findOne('snippet-1', 'stranger-id')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update when user is owner', async () => {
      const snippetWithRelations = { ...mockSnippet, user: mockUser, shares: [] };
      snippetRepo.findOne.mockResolvedValue(snippetWithRelations);
      const updated = { ...snippetWithRelations, title: 'Updated' };
      snippetRepo.save.mockResolvedValue(updated);

      const dto: UpdateSnippetDto = { title: 'Updated' };
      const result = await service.update('snippet-1', dto, 'owner-id');
      expect(snippetRepo.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated');
    });

    it('should throw ForbiddenException when user is not owner and not shared with', async () => {
      const snippetWithRelations = { ...mockSnippet, user: mockUser, shares: [] };
      snippetRepo.findOne.mockResolvedValue(snippetWithRelations);
      const dto: UpdateSnippetDto = { title: 'Updated' };
      await expect(service.update('snippet-1', dto, 'other-id')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete when user is owner', async () => {
      snippetRepo.findOne.mockResolvedValue({ ...mockSnippet, user: mockUser });
      const result = await service.remove('snippet-1', 'owner-id');
      expect(snippetRepo.delete).toHaveBeenCalledWith('snippet-1');
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      snippetRepo.findOne.mockResolvedValue({ ...mockSnippet, user: mockUser });
      await expect(service.remove('snippet-1', 'other-id')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('shareSnippet', () => {
    it('should create shares for given userIds', async () => {
      snippetRepo.findOne.mockResolvedValue({ ...mockSnippet, user: mockUser });
      userRepo.findOne.mockResolvedValue(mockOtherUser);
      snippetShareRepo.create.mockImplementation((opts: any) => opts);
      snippetShareRepo.save.mockResolvedValue({});

      const dto: ShareSnippetDto = { userIds: ['other-id'] };
      await service.shareSnippet('snippet-1', dto, 'owner-id');
      expect(snippetShareRepo.delete).toHaveBeenCalled();
      expect(snippetShareRepo.create).toHaveBeenCalled();
      expect(snippetShareRepo.save).toHaveBeenCalled();
    });

    it('should throw when user not found', async () => {
      snippetRepo.findOne.mockResolvedValue({ ...mockSnippet, user: mockUser });
      userRepo.findOne.mockResolvedValue(null);
      const dto: ShareSnippetDto = { userIds: ['missing-user'] };
      await expect(service.shareSnippet('snippet-1', dto, 'owner-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findShared', () => {
    it('should return snippets shared with user', async () => {
      const qb = snippetRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([mockSnippet]);
      const result = await service.findShared('other-id');
      expect(qb.where).toHaveBeenCalledWith('sharedWith.id = :userId', { userId: 'other-id' });
      expect(result).toEqual([mockSnippet]);
    });
  });
});
