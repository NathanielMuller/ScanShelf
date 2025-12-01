import { TestBed } from '@angular/core/testing';

import { ImageManagement } from './image-management';

describe('ImageManagement', () => {
  let service: ImageManagement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageManagement);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
