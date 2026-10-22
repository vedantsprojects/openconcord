export interface ModalService {
  openModal(channelId: string, props: { height?: number; width?: number }): Promise<{ success: boolean; modalId: string }> | null;
}

export class ModalServiceImplementation implements ModalService {
  public async openModal(channelId: string, props?: { height?: number; width?: number }): Promise<{ success: boolean; modalId: string } | null> {
    return { success: true, modalId: 'modal_' + channelId };
  }
}
