/**
 * OpenRouter 配置诊断脚本
 * 检查 OpenRouter API Key 配置和可用性
 * 
 * 使用方法:
 * pnpm tsx scripts/check-openrouter.ts
 */

import { getAllConfigs } from '@/shared/models/config';

async function checkOpenRouter() {
  console.log('🔍 检查 OpenRouter 配置...\n');

  try {
    // 1. 检查配置
    console.log('📋 步骤 1: 读取配置');
    const configs = await getAllConfigs();
    const apiKey = configs.openrouter_api_key;
    const baseUrl = configs.openrouter_base_url;

    if (!apiKey) {
      console.error('❌ OpenRouter API Key 未配置');
      console.log('\n解决方法:');
      console.log('1. 访问 /admin/settings');
      console.log('2. 在 AI 标签页设置 OpenRouter API Key');
      console.log('3. API Key 格式: sk-or-v1-...');
      process.exit(1);
    }

    console.log('✅ API Key 已配置');
    console.log(`   - 前缀: ${apiKey.substring(0, 10)}...`);
    console.log(`   - 长度: ${apiKey.length} 字符`);
    console.log(`   - Base URL: ${baseUrl || 'default (https://openrouter.ai/api/v1)'}`);

    // 2. 验证 API Key 格式
    console.log('\n📋 步骤 2: 验证 API Key 格式');
    if (!apiKey.startsWith('sk-or-v1-')) {
      console.warn('⚠️  API Key 格式可能不正确');
      console.log('   OpenRouter API Key 通常以 sk-or-v1- 开头');
    } else {
      console.log('✅ API Key 格式正确');
    }

    // 3. 测试 API 连接
    console.log('\n📋 步骤 3: 测试 API 连接');
    const testUrl = baseUrl || 'https://openrouter.ai/api/v1';
    
    try {
      const response = await fetch(`${testUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        console.error(`❌ API 请求失败: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log('\n响应内容:');
        console.log(text.substring(0, 500));
        
        if (response.status === 401) {
          console.log('\n💡 提示: API Key 无效或已过期');
          console.log('   请访问 https://openrouter.ai/keys 重新生成');
        } else if (response.status === 402) {
          console.log('\n💡 提示: 账户余额不足');
          console.log('   请访问 https://openrouter.ai/credits 充值');
        }
        process.exit(1);
      }

      const data = await response.json();
      console.log('✅ API 连接成功');
      console.log(`   - 可用模型数量: ${data.data?.length || 0}`);

      // 4. 检查目标模型
      console.log('\n📋 步骤 4: 检查目标模型可用性');
      const targetModels = [
        'openai/gpt-5',
        'openai/gpt-4o',
        'anthropic/claude-3.5-sonnet',
        'deepseek/deepseek-r1',
        'anthropic/claude-4.5-sonnet',
        'moonshotai/kimi-k2-thinking',
      ];

      const availableModels = data.data?.map((m: any) => m.id) || [];
      
      for (const model of targetModels) {
        const isAvailable = availableModels.includes(model);
        if (isAvailable) {
          console.log(`   ✅ ${model}`);
        } else {
          console.log(`   ❌ ${model} (不可用)`);
        }
      }

      // 5. 检查账户信息
      console.log('\n📋 步骤 5: 检查账户信息');
      try {
        const creditsResponse = await fetch(`${testUrl}/auth/key`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json();
          console.log('✅ 账户信息:');
          console.log(`   - 余额: $${creditsData.data?.usage || 'N/A'}`);
          console.log(`   - 限额: ${creditsData.data?.limit || 'N/A'}`);
        } else {
          console.log('⚠️  无法获取账户信息');
        }
      } catch (e) {
        console.log('⚠️  无法获取账户信息');
      }

      console.log('\n✅ 所有检查完成！');
      console.log('\n💡 如果世代查找器仍然出错，请检查:');
      console.log('   1. 确保至少有一个目标模型可用');
      console.log('   2. 确保账户余额充足');
      console.log('   3. 查看服务器日志获取详细错误信息');

    } catch (error: any) {
      console.error('❌ 网络请求失败:', error.message);
      console.log('\n可能的原因:');
      console.log('1. 网络连接问题');
      console.log('2. Base URL 配置错误');
      console.log('3. 防火墙或代理阻止了请求');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行检查
checkOpenRouter();
