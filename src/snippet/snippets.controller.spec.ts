import { Test, TestingModule } from '@nestjs/testing';
import { SnippetsController } from './snippets.controller';
import { SnippetsService } from './snippets.service';
import { User } from '../users/entities/user.entity';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';
import { ShareSnippetDto } from './dto/share-snippet.dto';

const mockUser: User = {
  id: 'user-1',
  name: 'User',
  email: 'user@example.com',
  passwordHash: 'hash',
  snippets: [],
  createdAt: new Date(),
};

const mockSnippetsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findPublic: jest.fn(),
  findShared: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  shareSnippet: jest.fn(),
};

describe('SnippetsController', () => {
  let controller: SnippetsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SnippetsController],
      providers: [{ provide: SnippetsService, useValue: mockSnippetsService }],
    }).compile();

    controller = module.get<SnippetsController>(SnippetsController);
    jest.clearAllMocks();
  });

  it('create should call service.create with dto and req.user', async () => {
    const dto: CreateSnippetDto = {
      title: 'T',
      code: 'c',
      language: 'javascript',
      isPublic: false,
    };
    mockSnippetsService.create.mockResolvedValue({ id: 'new-id' });
    const req = { user: mockUser };
    await controller.create(dto, req);
    expect(mockSnippetsService.create).toHaveBeenCalledWith(dto, mockUser);
  });

  it('findAll should pass req.user?.id', async () => {
    mockSnippetsService.findAll.mockResolvedValue([]);
    const req = { user: mockUser };
    await controller.findAll(req);
    expect(mockSnippetsService.findAll).toHaveBeenCalledWith(mockUser?.id);
  });

  it('findOne should pass id and req.user?.id', async () => {
    mockSnippetsService.findOne.mockResolvedValue({});
    const req = { user: mockUser };
    await controller.findOne('snippet-1', req);
    expect(mockSnippetsService.findOne).toHaveBeenCalledWith('snippet-1', mockUser?.id);
  });

  it('update should pass id, dto, req.user.id', async () => {
    const dto: UpdateSnippetDto = { title: 'Updated' };
    mockSnippetsService.update.mockResolvedValue({});
    const req = { user: mockUser };
    await controller.update('snippet-1', dto, req);
    expect(mockSnippetsService.update).toHaveBeenCalledWith('snippet-1', dto, mockUser.id);
  });

  it('remove should pass id and req.user.id', async () => {
    mockSnippetsService.remove.mockResolvedValue(true);
    const req = { user: mockUser };
    await controller.remove('snippet-1', req);
    expect(mockSnippetsService.remove).toHaveBeenCalledWith('snippet-1', mockUser.id);
  });

  it('shareSnippet should pass id, dto, req.user.id', async () => {
    const dto: ShareSnippetDto = { userIds: ['user-2'] };
    mockSnippetsService.shareSnippet.mockResolvedValue(undefined);
    const req = { user: mockUser };
    await controller.shareSnippet('snippet-1', dto, req);
    expect(mockSnippetsService.shareSnippet).toHaveBeenCalledWith('snippet-1', dto, mockUser.id);
  });
});
