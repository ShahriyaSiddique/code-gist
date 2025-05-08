import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { CreateSnippetDto } from './dto/create-snippet.dto';
import { UpdateSnippetDto } from './dto/update-snippet.dto';
import { SnippetsService } from './snippets.service';

@Controller('snippets')
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(ResponseInterceptor)
export class SnippetsController {
    constructor(private readonly snippetsService: SnippetsService) { }

    @Post()
    create(@Body() createSnippetDto: CreateSnippetDto, @Request() req) {
        return this.snippetsService.create(createSnippetDto, req.user);
    }

    @Get()
    findAll(@Request() req) {
        return this.snippetsService.findAll(req.user?.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.snippetsService.findOne(id, req.user?.id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateSnippetDto: UpdateSnippetDto, @Request() req) {
        return this.snippetsService.update(id, updateSnippetDto, req.user.id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.snippetsService.remove(id, req.user.id);
    }
}