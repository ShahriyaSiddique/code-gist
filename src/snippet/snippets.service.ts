import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';
import { Snippets } from './entities/snippets.entity';

@Injectable()
export class SnippetsService {
    constructor(
    @InjectRepository(Snippets)
    private snippetRepository: Repository<Snippets>,
    ) { }

    async findAll(userId?: string): Promise<Snippets[]> {
        const queryBuilder = this.snippetRepository
            .createQueryBuilder('snippet')
            .leftJoinAndSelect('snippet.user', 'user');

        if (userId) {
            // If user is authenticated, show their private snippets and all public snippets
            queryBuilder.where('(snippet.isPublic = :isPublic OR snippet.user.id = :userId)', {
                isPublic: true,
                userId,
            });
        } else {
            // If user is not authenticated, show only public snippets
            queryBuilder.where('snippet.isPublic = :isPublic', { isPublic: true });
        }

        return queryBuilder.getMany();
    }

    async create(createSnippetDto: CreateSnippetDto, user: User): Promise<{ id: string; }> {
        const snippets = this.snippetRepository.create({
            ...createSnippetDto,
            user,
        });
        const savedSnippet = await this.snippetRepository.save(snippets);
        return { id: savedSnippet.id };
    }

    async findOne(id: string, userId?: string): Promise<Snippets> {
        const snippet = await this.snippetRepository.findOne({
            where: { id },
            relations: ['user'],
        });
        if (!snippet) {
            throw new NotFoundException('Snippets not found');
        }

        if (!snippet.isPublic && snippet.user?.id !== userId) {
            throw new ForbiddenException('You do not have access to this snippets');
        }
        return snippet;
    }

    async update(id: string, updateSnippetDto: UpdateSnippetDto, userId: string): Promise<Snippets> {
        const snippets = await this.findOne(id, userId);
        if (snippets.user.id !== userId) {
            throw new ForbiddenException('You can only update your own snippets');
        }
        Object.assign(snippets, updateSnippetDto);
        return this.snippetRepository.save(snippets);
    }

    async remove(id: string, userId: string): Promise<boolean> {
        const snippets = await this.findOne(id, userId);
        if (snippets.user.id !== userId) {
            throw new ForbiddenException('You can only delete your own snippets');
        }
        const result = await this.snippetRepository.delete(id);
        return result.affected > 0;
    }
}