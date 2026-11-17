import { useNavigate } from 'react-router-dom';
import { PAGE_PATHS, type Page } from '../types';

export function useGoTo() {
  const navigate = useNavigate();
  return (page: Page) => navigate(PAGE_PATHS[page]);
}
