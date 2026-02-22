import type {
  StorageConfigs,
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from '.';

/**
 * S3 storage provider configs
 * @docs https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html
 */
export interface S3Configs extends StorageConfigs {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain?: string;
}

/**
 * S3 storage provider implementation
 * @website https://aws.amazon.com/s3/
 */
export class S3Provider implements StorageProvider {
  readonly name = 's3';
  configs: S3Configs;

  constructor(configs: S3Configs) {
    this.configs = configs;
  }

  private trimSlashes(value: string) {
    return value.replace(/^\/+|\/+$/g, '');
  }

  private joinPathParts(...parts: Array<string | undefined | null>) {
    return parts
      .map((part) => (part ? this.trimSlashes(part) : ''))
      .filter(Boolean)
      .join('/');
  }

  private resolveKeyFromPathname({
    pathname,
    basePathname,
    bucket,
  }: {
    pathname: string;
    basePathname: string;
    bucket: string;
  }): string | null {
    const normalizedPath = this.trimSlashes(pathname);
    const normalizedBase = this.trimSlashes(basePathname);
    const prefixWithBucket = this.joinPathParts(normalizedBase, bucket);
    const prefixWithoutBucket = normalizedBase;

    for (const prefix of [prefixWithBucket, prefixWithoutBucket]) {
      if (!prefix) {
        continue;
      }
      const fullPrefix = `${prefix}/`;
      if (normalizedPath.startsWith(fullPrefix)) {
        return normalizedPath.slice(fullPrefix.length);
      }
    }

    return null;
  }

  getPublicUrl = (options: { key: string; bucket?: string }) => {
    const uploadBucket = options.bucket || this.configs.bucket;
    const url = `${this.configs.endpoint}/${uploadBucket}/${options.key}`;
    return this.configs.publicDomain
      ? `${this.configs.publicDomain}/${options.key}`
      : url;
  };

  getKeyFromUrl = (url: string): string | null => {
    try {
      const parsedUrl = new URL(url);
      const uploadBucket = this.configs.bucket;

      const endpoint = new URL(this.configs.endpoint);
      if (parsedUrl.origin === endpoint.origin) {
        const key = this.resolveKeyFromPathname({
          pathname: parsedUrl.pathname,
          basePathname: endpoint.pathname,
          bucket: uploadBucket,
        });
        if (key) {
          return key;
        }
      }

      if (this.configs.publicDomain) {
        const publicDomain = new URL(this.configs.publicDomain);
        if (parsedUrl.origin === publicDomain.origin) {
          return this.resolveKeyFromPathname({
            pathname: parsedUrl.pathname,
            basePathname: publicDomain.pathname,
            bucket: uploadBucket,
          });
        }
      }
    } catch {
      return null;
    }

    return null;
  };

  exists = async (options: { key: string; bucket?: string }) => {
    try {
      const uploadBucket = options.bucket || this.configs.bucket;
      if (!uploadBucket) return false;

      const url = `${this.configs.endpoint}/${uploadBucket}/${options.key}`;
      const { AwsClient } = await import('aws4fetch');
      const client = new AwsClient({
        accessKeyId: this.configs.accessKeyId,
        secretAccessKey: this.configs.secretAccessKey,
        region: this.configs.region,
      });

      const response = await client.fetch(
        new Request(url, {
          method: 'HEAD',
        })
      );

      return response.ok;
    } catch {
      return false;
    }
  };

  async uploadFile(
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      const uploadBucket = options.bucket || this.configs.bucket;
      if (!uploadBucket) {
        return {
          success: false,
          error: 'Bucket is required',
          provider: this.name,
        };
      }

      const bodyArray =
        options.body instanceof Buffer
          ? new Uint8Array(options.body)
          : options.body;

      const url = `${this.configs.endpoint}/${uploadBucket}/${options.key}`;

      const { AwsClient } = await import('aws4fetch');

      const client = new AwsClient({
        accessKeyId: this.configs.accessKeyId,
        secretAccessKey: this.configs.secretAccessKey,
        region: this.configs.region,
      });

      const headers: Record<string, string> = {
        'Content-Type': options.contentType || 'application/octet-stream',
        'Content-Disposition': options.disposition || 'inline',
        'Content-Length': bodyArray.length.toString(),
      };

      const request = new Request(url, {
        method: 'PUT',
        headers,
        body: bodyArray as any,
      });

      const response = await client.fetch(request);

      if (!response.ok) {
        return {
          success: false,
          error: `Upload failed: ${response.statusText}`,
          provider: this.name,
        };
      }

      const publicUrl =
        this.getPublicUrl({ key: options.key, bucket: uploadBucket }) || url;

      return {
        success: true,
        location: url,
        bucket: uploadBucket,
        key: options.key,
        filename: options.key.split('/').pop(),
        url: publicUrl,
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  async deleteFile(options: { key: string; bucket?: string }): Promise<boolean> {
    try {
      const uploadBucket = options.bucket || this.configs.bucket;
      if (!uploadBucket) {
        return false;
      }

      const url = `${this.configs.endpoint}/${uploadBucket}/${options.key}`;
      const { AwsClient } = await import('aws4fetch');
      const client = new AwsClient({
        accessKeyId: this.configs.accessKeyId,
        secretAccessKey: this.configs.secretAccessKey,
        region: this.configs.region,
      });

      const response = await client.fetch(
        new Request(url, {
          method: 'DELETE',
        })
      );

      return response.ok || response.status === 404;
    } catch {
      return false;
    }
  }

  async downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      const response = await fetch(options.url);
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP error! status: ${response.status}`,
          provider: this.name,
        };
      }

      if (!response.body) {
        return {
          success: false,
          error: 'No body in response',
          provider: this.name,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);

      return this.uploadFile({
        body,
        key: options.key,
        bucket: options.bucket,
        contentType: options.contentType,
        disposition: options.disposition,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }
}

/**
 * Create S3 provider with configs
 */
export function createS3Provider(configs: S3Configs): S3Provider {
  return new S3Provider(configs);
}
