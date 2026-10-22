import { ModalServiceImplementation } from '../../src/layer3/modal.service';

describe('ModalService', () => {
  it('should open a modal and return a modal ID', async () => {
    const service = new ModalServiceImplementation();
    const result = await service.openModal('channel-1', { height: 400, width: 600 });

    expect(result).toEqual({ success: true, modalId: 'modal_channel-1' });
    expect((result as any).modalId).toBe('modal_channel-1');
  });

  it('should handle optional width and height parameters', async () => {
    const service = new ModalServiceImplementation();

    // Without dimensions
    const result1 = await service.openModal('channel-1');
    expect(result1).toEqual({ success: true, modalId: 'modal_channel-1' });

    // With dimensions
    const result2 = await service.openModal('channel-1', { height: 500, width: 800 });
    expect((result2 as any).success).toBeTruthy();
  });

  it('should return unique modal IDs for each open call', async () => {
    const service = new ModalServiceImplementation();
    const result1 = await service.openModal('channel-a');
    const result2 = await service.openModal('channel-b');

    expect((result1 as any).modalId).not.toBe((result2 as any).modalId);
  });
});